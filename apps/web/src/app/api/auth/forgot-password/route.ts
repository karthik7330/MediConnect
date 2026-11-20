import { NextRequest, NextResponse } from 'next/server';
import { mailerService } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const resetToken = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Send real email via Resend
    await mailerService.sendEmail({
      to: email.trim(),
      subject: '🔑 MediConnect Password Reset Instructions',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; max-width: 520px;">
          <h2 style="color: #0F172A; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #475569; font-size: 14px;">
            A password reset was requested for your MediConnect account (<strong>${email}</strong>).
          </p>
          <div style="background-color: white; border: 1px dashed #DC2626; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #64748B;">Temporary Access Token:</p>
            <p style="margin: 8px 0; font-family: monospace; font-size: 24px; font-weight: bold; color: #DC2626;">${resetToken}</p>
          </div>
          <p style="color: #64748B; font-size: 12px;">
            If you did not request this, please disregard this email. Your credentials remain safe.
          </p>
        </div>
      `
    });

    return NextResponse.json({ 
      success: true, 
      message: `Password reset instructions sent to ${email}` 
    });
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Failed to process request' 
    }, { status: 500 });
  }
}
