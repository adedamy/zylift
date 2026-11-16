// Real SMS Gateway Dispatcher (Termii & Twilio with Dev Simulation Fallback)

export interface SmsSendResult {
  success: boolean;
  provider: 'termii' | 'twilio' | 'simulation';
  messageId?: string;
  error?: string;
}

export class SmsService {
  private termiiApiKey: string | undefined;
  private termiiSenderId: string;
  private twilioSid: string | undefined;
  private twilioToken: string | undefined;
  private twilioFrom: string | undefined;

  constructor() {
    this.termiiApiKey = process.env.TERMII_API_KEY;
    this.termiiSenderId = process.env.TERMII_SENDER_ID || 'Zylift';
    this.twilioSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  }

  // Format Nigerian phone number into international MSISDN (2348000000000)
  public formatMsisdn(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('234')) return digits;
    if (digits.startsWith('0')) return `234${digits.slice(1)}`;
    return `234${digits}`;
  }

  // Send One-Time-Password (OTP)
  public async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const formattedPhone = this.formatMsisdn(phone);
    const message = `Your Zylift FUTMINNA verification code is ${code}. Valid for 5 minutes. Do not share this code.`;

    // 1. Try Termii (Leading Nigerian SMS provider)
    const termiiKey = process.env.TERMII_API_KEY || this.termiiApiKey;
    const termiiSender = process.env.TERMII_SENDER_ID || this.termiiSenderId || 'Termii';
    let termiiErrorDetail: string | undefined;

    if (termiiKey && termiiKey.trim().length > 0 && !termiiKey.includes('...')) {
      try {
        // Try DND channel first (delivers to all Nigerian networks even if DND is active)
        const response = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formattedPhone,
            from: termiiSender,
            sms: message,
            type: 'plain',
            channel: 'dnd',
            api_key: termiiKey.trim(),
          }),
        });
        const data: any = await response.json();
        if (response.ok && (data.code === 'ok' || data.message === 'Successfully Sent' || data.message_id)) {
          console.log(`[SMS Gateway / Termii] Real OTP dispatched to ${formattedPhone} (Message ID: ${data.message_id})`);
          return { success: true, provider: 'termii', messageId: data.message_id };
        } else {
          termiiErrorDetail = data.message || data.error;
          console.warn(`[SMS Gateway / Termii Response] Notice: ${JSON.stringify(data)}`);
          // If DND channel failed, try generic channel fallback
          const genericResp = await fetch('https://api.ng.termii.com/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: formattedPhone,
              from: termiiSender,
              sms: message,
              type: 'plain',
              channel: 'generic',
              api_key: termiiKey.trim(),
            }),
          });
          const genericData: any = await genericResp.json();
          if (genericResp.ok && (genericData.code === 'ok' || genericData.message === 'Successfully Sent' || genericData.message_id)) {
            console.log(`[SMS Gateway / Termii (Generic)] OTP dispatched to ${formattedPhone}`);
            return { success: true, provider: 'termii', messageId: genericData.message_id };
          }
          termiiErrorDetail = genericData.message || termiiErrorDetail;
          console.warn(`[SMS Gateway / Termii Fallback] Failed: ${JSON.stringify(genericData)}`);
        }
      } catch (err: any) {
        termiiErrorDetail = err.message;
        console.warn('[SMS Gateway / Termii] Failed to dispatch via Termii:', err.message);
      }
    }

    // 2. Try Twilio
    if (this.twilioSid && this.twilioToken && this.twilioFrom) {
      try {
        const auth = Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', `+${formattedPhone}`);
        params.append('From', this.twilioFrom);
        params.append('Body', message);

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        const data = await response.json();
        if (response.ok && data.sid) {
          console.log(`[SMS Gateway / Twilio] OTP sent to ${formattedPhone}`);
          return { success: true, provider: 'twilio', messageId: data.sid };
        }
      } catch (err: any) {
        console.warn('[SMS Gateway / Twilio] Failed to dispatch via Twilio:', err.message);
      }
    }

    // 3. Fallback to Local Sandbox Simulation (Strictly forbidden in production)
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      console.warn(`[SMS Gateway / Production Error] Cellular SMS gateway failed or not configured for ${formattedPhone}`);
      return {
        success: false,
        provider: 'simulation',
        error: termiiErrorDetail || 'SMS delivery failed: Cellular SMS provider not configured or rejected in production.',
      };
    }

    // In dev / sandbox mode, log simulation message
    console.log(`[SMS Gateway / Sandbox Simulation] Message to ${formattedPhone}: "${message}"`);
    return {
      success: true,
      provider: 'simulation',
      messageId: `sim_${Date.now()}`,
      error: termiiErrorDetail,
    };
  }

  // Send Driver Arrival / Trip Alert
  public async sendTripNotification(phone: string, text: string): Promise<SmsSendResult> {
    const formattedPhone = this.formatMsisdn(phone);
    const message = `[Zylift Campus] ${text}`;

    if (this.termiiApiKey) {
      try {
        const response = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formattedPhone,
            from: this.termiiSenderId,
            sms: message,
            type: 'plain',
            channel: 'generic',
            api_key: this.termiiApiKey,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          return { success: true, provider: 'termii', messageId: data.message_id };
        }
      } catch (err) {}
    }

    console.log(`[SMS Gateway / Sandbox Notification] To ${formattedPhone}: "${message}"`);
    return { success: true, provider: 'simulation', messageId: `sim_${Date.now()}` };
  }
}

export const smsService = new SmsService();
