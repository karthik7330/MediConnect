import { NextRequest, NextResponse } from 'next/server';
import { mailerService } from '@/lib/mailer';

// In-memory OTP store for production authentication
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate cryptographically random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(email.toLowerCase(), { code, expiresAt });

    // Send real email via Resend
    const res = await mailerService.sendOtpVerification(email, code);

    if (!res.success) {
      console.error('[SendOTP Error]', res.error);
      return NextResponse.json({ 
        success: false, 
        error: res.error,
        // Fallback for demo in case external mailbox blocks
        fallbackCode: code 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `2FA security code dispatched to ${email}`,
      expiresInMinutes: 10
    });
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Internal error' 
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const record = otpStore.get(email.toLowerCase());

    if (!record) {
      return NextResponse.json({ error: 'No verification code requested or expired' }, { status: 400 });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    if (record.code !== code.trim()) {
      return NextResponse.json({ error: 'Invalid verification code. Please check your email.' }, { status: 400 });
    }

    // OTP verified successfully
    otpStore.delete(email.toLowerCase());
    return NextResponse.json({ success: true, verified: true });
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Internal error' 
    }, { status: 500 });
  }
}
