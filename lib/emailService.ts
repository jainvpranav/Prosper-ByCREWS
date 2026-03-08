import aws4 from 'aws4';

export async function sendAppointmentConfirmationEmail(
  toAddress: string,
  appointmentDetails: {
    locationName: string;
    appointmentDate: string;
    timeSlot: string;
    provider: string;
  }
) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    console.warn("[EmailService] Missing AWS credentials, skipping email send.");
    return;
  }

  const host = `email.${region}.amazonaws.com`;
  
  const body = new URLSearchParams({
    Action: 'SendEmail',
    'Destination.ToAddresses.member.1': toAddress,
    'Message.Body.Html.Data': `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">Appointment Confirmed</h2>
        <p>Your appointment has been successfully scheduled.</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 16px;">
          <p style="margin: 8px 0;"><strong>Location:</strong> ${appointmentDetails.locationName}</p>
          <p style="margin: 8px 0;"><strong>Date:</strong> ${appointmentDetails.appointmentDate}</p>
          <p style="margin: 8px 0;"><strong>Time:</strong> ${appointmentDetails.timeSlot}</p>
          <p style="margin: 8px 0;"><strong>Provider:</strong> ${appointmentDetails.provider}</p>
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Thank you for choosing Prosper Health.</p>
      </div>
    `,
    'Message.Body.Text.Data': `Your appointment is confirmed at ${appointmentDetails.locationName} on ${appointmentDetails.appointmentDate} (${appointmentDetails.timeSlot}) with ${appointmentDetails.provider}.`,
    'Message.Subject.Data': 'Prosper Health - Appointment Confirmation',
    'Source': 'no-reply@prosper-health.com',
  }).toString();

  const opts: aws4.Request = {
    service: 'email',
    region,
    host,
    path: '/',
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  aws4.sign(opts, { accessKeyId, secretAccessKey });

  try {
    const res = await fetch(`https://${host}/`, {
      method: opts.method,
      headers: opts.headers as Record<string, string>,
      body: opts.body as string,
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error("[EmailService] Failed to send email via SES:", text);
    } else {
      console.log("[EmailService] Confirmation email sent successfully to", toAddress);
    }
  } catch (err) {
    console.error("[EmailService] Network error sending email:", err);
  }
}
