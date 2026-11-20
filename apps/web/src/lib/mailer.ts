export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export const mailerService = {
  async sendEmail(payload: EmailPayload): Promise<{ success: boolean; data?: any; error?: string }> {
    const apiKey = process.env.RESEND_API_KEY || '';

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'MediConnect Alert <onboarding@resend.dev>',
          to: payload.to,
          subject: payload.subject,
          html: payload.html
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to send email' };
      }

      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  },

  // 2FA One-Time Passcode Dispatch (Section 15 & 16 requirement)
  async sendOtpVerification(adminEmail: string, otpCode: string): Promise<{ success: boolean; error?: string }> {
    return await this.sendEmail({
      to: adminEmail,
      subject: `🔐 ${otpCode} is your MediConnect Admin 2FA Verification Code`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; background-color: #F8FAFC; border-radius: 16px; max-width: 520px; margin: 0 auto; border: 1px solid #E2E8F0;">
          <div style="display: flex; align-items: center; margin-bottom: 24px;">
            <div style="background-color: #DC2626; color: white; width: 36px; height: 36px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center;">+</div>
            <span style="font-size: 18px; font-weight: 800; color: #0F172A; margin-left: 12px; letter-spacing: -0.5px;">MediConnect Emergency</span>
          </div>
          <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">Two-Factor Authentication Code</h2>
          <p style="color: #64748B; font-size: 14px; line-height: 22px; margin-top: 0; margin-bottom: 24px;">
            Hello <strong>Karthik</strong>, you are signing in to the MediConnect Emergency Command & Dispatch Center. Use the one-time security code below to complete your authorization:
          </p>
          <div style="background-color: #FFFFFF; border: 2px dashed #DC2626; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <div style="font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #DC2626;">
              ${otpCode}
            </div>
            <div style="color: #94A3B8; font-size: 11px; margin-top: 8px; font-weight: 600; text-transform: uppercase;">Valid for 10 minutes</div>
          </div>
          <p style="color: #64748B; font-size: 12px; line-height: 18px; margin: 0;">
            If you did not request this verification, someone may be attempting to access your administrative portal. Please secure your account immediately.
          </p>
        </div>
      `
    });
  },

  // 15-Minute Lockout Alert (Section 16 requirement)
  async sendLockoutAlert(adminEmail: string, ipAddress: string): Promise<void> {
    await this.sendEmail({
      to: adminEmail,
      subject: '⚠️ SECURITY ALERT: MediConnect Admin Account Temporarily Locked',
      html: `
        <div style="font-family: sans-serif; padding: 24px; background-color: #FEF2F2; border-radius: 12px; border: 1px solid #F87171;">
          <h2 style="color: #991B1B; margin-top: 0;">MediConnect Security Alert</h2>
          <p style="color: #4B5563; font-size: 14px;">
            An administrative account detected <strong>5 consecutive failed login attempts</strong>.
          </p>
          <div style="background-color: white; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0; font-size: 13px;"><strong>Security Action:</strong> 15-minute brute-force lockout engaged</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Timestamp:</strong> ${new Date().toUTCString()}</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>IP Origin:</strong> ${ipAddress}</p>
          </div>
          <p style="color: #6B7280; font-size: 12px; margin-bottom: 0;">
            If this was not you, please inspect your MediConnect administrative activity logs immediately.
          </p>
        </div>
      `
    });
  },

  // New-Device Sign-in Alert (Section 15 & 16 requirement)
  async sendNewDeviceAlert(adminEmail: string, deviceInfo: string): Promise<void> {
    await this.sendEmail({
      to: adminEmail,
      subject: '🔔 Security Notice: New Device Sign-In to MediConnect Admin',
      html: `
        <div style="font-family: sans-serif; padding: 24px; background-color: #F0FDF4; border-radius: 12px; border: 1px solid #86EFAC;">
          <h2 style="color: #166534; margin-top: 0;">New Device Login Detected</h2>
          <p style="color: #374151; font-size: 14px;">
            Your MediConnect administrative account was successfully authenticated from a new terminal:
          </p>
          <p style="background: white; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px;">
            ${deviceInfo}
          </p>
        </div>
      `
    });
  }
};
