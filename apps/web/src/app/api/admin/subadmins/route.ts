import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mailerService } from '@/lib/mailer';
import { randomUUID } from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hrhpenogpldpfzbpvdpy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// GET: List all Sub-Admins and their permissions
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
      return {
        ...p,
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

// POST: Main Admin manually creates and assigns a new Sub-Admin
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, phone, permissions } = body;

    if (!fullName || !email || !phone) {
      return NextResponse.json({ error: 'Full name, email, and phone number are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

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

    // 3. Dispatch notification email (non-blocking: never fails the appointment if email service is unconfigured)
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
              <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Email:</strong> ${cleanEmail}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Initial Password:</strong> admin@123</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Portal URL:</strong> https://medi-connect-five.vercel.app</p>
            </div>
            <p style="color: #64748B; font-size: 12px;">
              Your granular role permissions have been activated in the system.
            </p>
          </div>
        `
      });
    } catch (mailErr) {
      console.warn('Notice email dispatch skipped:', mailErr);
    }

    return NextResponse.json({ 
      success: true, 
      subadmin: savedProfile || { id: subAdminId, full_name: fullName, email: cleanEmail, phone_number: cleanPhone, role: 'SUB_ADMIN' },
      message: `Sub-Admin ${fullName} successfully appointed.`
    });
  } catch (err: unknown) {
    console.error('Sub-Admin appointment error:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to create sub-admin' 
    }, { status: 500 });
  }
}

// PUT: Toggle granular permissions
export async function PUT(req: NextRequest) {
  try {
    const { adminId, permissions } = await req.json();

    if (!adminId || !permissions) {
      return NextResponse.json({ error: 'adminId and permissions required' }, { status: 400 });
    }

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

    return NextResponse.json({ success: true, message: 'Permissions updated successfully.' });
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to update permissions' 
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
