import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mailerService } from '@/lib/mailer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
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

    if (permErr) throw permErr;

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

    const subAdminId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // 1. Insert into profiles table
    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: subAdminId,
        role: 'SUB_ADMIN',
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone_number: phone.trim(),
        is_approved: true,
        is_deactivated: false
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // 2. Insert into sub_admin_permissions table
    const { error: permError } = await supabaseAdmin
      .from('sub_admin_permissions')
      .insert({
        admin_id: subAdminId,
        can_approve_ambulance: Boolean(permissions?.can_approve_ambulance),
        can_manage_users: Boolean(permissions?.can_manage_users),
        can_manual_assign: Boolean(permissions?.can_manual_assign),
        can_view_analytics: Boolean(permissions?.can_view_analytics),
        can_view_logs: Boolean(permissions?.can_view_logs)
      });

    if (permError) {
      console.warn('Permissions insert warning:', permError.message);
    }

    // 3. Dispatch real notification email via Resend
    await mailerService.sendEmail({
      to: email.trim(),
      subject: '🛡️ MediConnect Sub-Administrator Appointment Notice',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; max-width: 520px;">
          <h2 style="color: #0F172A; margin-top: 0;">MediConnect Command Portal Access</h2>
          <p style="color: #475569; font-size: 14px;">
            Hello <strong>${fullName}</strong>, you have been designated as a <strong>Sub-Administrator</strong> by Main Administrator <strong>Karthik</strong>.
          </p>
          <div style="background-color: white; border: 1px solid #CBD5E1; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Email:</strong> ${email}</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Initial Password:</strong> admin@123</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Portal URL:</strong> http://localhost:3000</p>
          </div>
          <p style="color: #64748B; font-size: 12px;">
            Your granular role permissions have been activated in the system. Please change your password upon initial sign in.
          </p>
        </div>
      `
    });

    return NextResponse.json({ 
      success: true, 
      subadmin: newProfile,
      message: `Sub-Admin ${fullName} successfully created and appointed.`
    });
  } catch (err: unknown) {
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
