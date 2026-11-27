import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { mailerService } from '@/lib/mailer';
import { randomUUID } from 'crypto';

// GET: List all Sub-Admins with their permissions and assigned 10KM operational areas
export async function GET() {
  try {
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'SUB_ADMIN')
      .order('created_at', { ascending: false });

    if (pErr) throw pErr;

    const { data: perms, error: permErr } = await supabaseAdmin
      .from('sub_admin_permissions')
      .select('*');

    if (permErr) {
      console.warn('sub_admin_permissions fetch warning:', permErr.message);
    }

    const combined = (profiles || []).map(p => {
      const perm = (perms || []).find(pm => pm.admin_id === p.id) || {
        can_approve_ambulance: false,
        can_manage_users: false,
        can_manual_assign: false,
        can_view_analytics: false,
        can_view_logs: false
      };

      let area = { sector: 'Central Sector', lat: 13.0827, lng: 80.2707, radiusKm: 10 };
      if (p.medical_notes) {
        try {
          const parsed = JSON.parse(p.medical_notes);
          if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            area = {
              sector: parsed.sector || 'Designated Zone',
              lat: Number(parsed.lat),
              lng: Number(parsed.lng),
              radiusKm: Number(parsed.radiusKm || parsed.radius_km || 10)
            };
          }
        } catch {
          // ignore non-json
        }
      }

      return {
        ...p,
        area,
        permissions: perm
      };
    });

    return NextResponse.json({ success: true, subadmins: combined });
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to fetch sub-admins' 
    }, { status: 500 });
  }
}

// POST: Main Admin appoints a new Sub-Admin with designated coordinates & 10KM operational radius
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, phone, permissions, sectorName, assignedLat, assignedLng, radiusKm } = body;

    if (!fullName || !email || !phone) {
      return NextResponse.json({ error: 'Full name, email, and phone number are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // Sector & 10KM Operational Area configuration
    const areaConfig = {
      sector: sectorName?.trim() || 'Central Sector Zone',
      lat: typeof assignedLat === 'number' ? assignedLat : parseFloat(assignedLat) || 13.0827,
      lng: typeof assignedLng === 'number' ? assignedLng : parseFloat(assignedLng) || 80.2707,
      radiusKm: typeof radiusKm === 'number' ? radiusKm : parseFloat(radiusKm) || 10
    };
    const areaJson = JSON.stringify(areaConfig);

    // 1. Check if profile already exists for this email or phone
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .or(`email.eq.${cleanEmail},phone_number.eq.${cleanPhone}`)
      .maybeSingle();

    let subAdminId: string;
    let savedProfile: any = null;

    if (existingProfile) {
      subAdminId = existingProfile.id;
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          role: 'SUB_ADMIN',
          full_name: fullName.trim(),
          email: cleanEmail,
          phone_number: cleanPhone,
          medical_notes: areaJson,
          is_approved: true,
          is_deactivated: false
        })
        .eq('id', subAdminId)
        .select()
        .single();

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }
      savedProfile = updated;
    } else {
      subAdminId = randomUUID();
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: subAdminId,
          role: 'SUB_ADMIN',
          full_name: fullName.trim(),
          email: cleanEmail,
          phone_number: cleanPhone,
          medical_notes: areaJson,
          is_approved: true,
          is_deactivated: false
        })
        .select()
        .single();

      if (insertError) {
        console.error('Profile insert error:', insertError);
        throw insertError;
      }
      savedProfile = inserted;
    }

    // 2. Upsert into sub_admin_permissions table
    try {
      const { error: permError } = await supabaseAdmin
        .from('sub_admin_permissions')
        .upsert({
          admin_id: subAdminId,
          can_approve_ambulance: Boolean(permissions?.can_approve_ambulance),
          can_manage_users: Boolean(permissions?.can_manage_users),
          can_manual_assign: Boolean(permissions?.can_manual_assign),
          can_view_analytics: Boolean(permissions?.can_view_analytics),
          can_view_logs: Boolean(permissions?.can_view_logs)
        });

      if (permError) {
        console.warn('Permissions upsert warning:', permError.message);
      }
    } catch (permCatchErr) {
      console.warn('Permissions table upsert warning:', permCatchErr);
    }

    // 3. Dispatch notification email
    try {
      await mailerService.sendEmail({
        to: cleanEmail,
        subject: '🛡️ MediConnect Sub-Administrator Appointment Notice',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; max-width: 520px;">
            <h2 style="color: #0F172A; margin-top: 0;">MediConnect Command Portal Access</h2>
            <p style="color: #475569; font-size: 14px;">
              Hello <strong>${fullName.trim()}</strong>, you have been designated as a <strong>Sub-Administrator</strong> by Main Administrator <strong>Karthik</strong>.
            </p>
            <div style="background-color: white; border: 1px solid #CBD5E1; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Sector:</strong> ${areaConfig.sector} (${areaConfig.radiusKm} KM Radius)</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Sector Coordinates:</strong> ${areaConfig.lat.toFixed(4)}, ${areaConfig.lng.toFixed(4)}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Email:</strong> ${cleanEmail}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Initial Password:</strong> admin@123</p>
            </div>
            <p style="color: #64748B; font-size: 12px;">
              Only emergency requests within your designated ${areaConfig.radiusKm} KM operational area will be routed to your command console.
            </p>
          </div>
        `
      });
    } catch (mailErr) {
      console.warn('Notice email dispatch skipped:', mailErr);
    }

    return NextResponse.json({ 
      success: true, 
      subadmin: {
        ...(savedProfile || { id: subAdminId, full_name: fullName, email: cleanEmail, phone_number: cleanPhone, role: 'SUB_ADMIN' }),
        area: areaConfig
      },
      message: `Sub-Admin ${fullName} successfully appointed for sector "${areaConfig.sector}" (${areaConfig.radiusKm} KM radius).`
    });
  } catch (err: unknown) {
    console.error('Sub-Admin appointment error:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to create sub-admin' 
    }, { status: 500 });
  }
}

// PUT: Toggle granular permissions or update area coordinates
export async function PUT(req: NextRequest) {
  try {
    const { adminId, permissions, sectorName, assignedLat, assignedLng, radiusKm } = await req.json();

    if (!adminId) {
      return NextResponse.json({ error: 'adminId required' }, { status: 400 });
    }

    if (permissions) {
      const { error } = await supabaseAdmin
        .from('sub_admin_permissions')
        .upsert({
          admin_id: adminId,
          can_approve_ambulance: Boolean(permissions.can_approve_ambulance),
          can_manage_users: Boolean(permissions.can_manage_users),
          can_manual_assign: Boolean(permissions.can_manual_assign),
          can_view_analytics: Boolean(permissions.can_view_analytics),
          can_view_logs: Boolean(permissions.can_view_logs)
        });

      if (error) throw error;
    }

    if (assignedLat && assignedLng) {
      const areaConfig = {
        sector: sectorName?.trim() || 'Designated Zone',
        lat: Number(assignedLat),
        lng: Number(assignedLng),
        radiusKm: Number(radiusKm) || 10
      };
      await supabaseAdmin
        .from('profiles')
        .update({ medical_notes: JSON.stringify(areaConfig) })
        .eq('id', adminId);
    }

    return NextResponse.json({ success: true, message: 'Sub-Admin updated successfully.' });
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to update sub-admin' 
    }, { status: 500 });
  }
}

// DELETE: Revoke Sub-Admin
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get('id');

    if (!adminId) {
      return NextResponse.json({ error: 'Sub-Admin ID required' }, { status: 400 });
    }

    await supabaseAdmin.from('sub_admin_permissions').delete().eq('admin_id', adminId);
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', adminId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Sub-Administrator access revoked.' });
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to delete sub-admin' 
    }, { status: 500 });
  }
}
