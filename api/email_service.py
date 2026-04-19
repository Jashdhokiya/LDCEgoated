"""
api/email_service.py
Lightweight email notification service using SMTP.

Sends HTML-formatted transactional emails for:
  - Welcome / registration confirmation
  - Profile completion confirmation
  - KYC verification result
  - Flag assignment notifications (for officers)

Configuration via environment variables:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

logger = logging.getLogger(__name__)

# ── SMTP Configuration ───────────────────────────────────────────────────────

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@eduguard.in")
SMTP_ENABLED = bool(SMTP_USER and SMTP_PASSWORD)

if not SMTP_ENABLED:
    logger.warning("[email] SMTP credentials not configured. Email notifications will be logged only.")


# ── HTML Template ─────────────────────────────────────────────────────────────

def _base_template(title: str, body_html: str, footer_text: str = "") -> str:
    """Wrap email body in a professional HTML template."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0f14;font-family:'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:32px auto;background:#13161d;border-radius:16px;overflow:hidden;border:1px solid #1e2330">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1a237e,#0d47a1);padding:28px 32px;text-align:center">
    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:8px 12px;margin-bottom:12px">
      <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:2px">🛡️ EduGuard</span>
    </div>
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px">{title}</h1>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;color:#c4c9d4;font-size:14px;line-height:1.7">
    {body_html}
  </div>

  <!-- Footer -->
  <div style="padding:20px 32px;border-top:1px solid #1e2330;text-align:center;color:#6b7280;font-size:11px">
    {footer_text or f"Sent by EduGuard DBT Monitoring System · {datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}"}
    <br>Gujarat State Education, Government of Gujarat
    <br><span style="color:#4b5563">This is an automated notification. Do not reply.</span>
  </div>
</div>
</body>
</html>"""


# ── Email Sending ─────────────────────────────────────────────────────────────

def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an email via SMTP. Returns True on success."""
    if not SMTP_ENABLED:
        logger.info(f"[email] (DRY RUN) To: {to_email} | Subject: {subject}")
        return True  # Pretend success when SMTP is not configured

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())

        logger.info(f"[email] Sent to {to_email}: {subject}")
        return True
    except Exception as exc:
        logger.error(f"[email] Failed to send to {to_email}: {exc}")
        return False


# ── Notification Templates ────────────────────────────────────────────────────

def send_welcome_email(to_email: str, name: str, user_id: str) -> bool:
    """Send welcome email after registration."""
    body = f"""
    <p style="margin:0 0 16px">Hello <strong style="color:#fff">{name}</strong>,</p>
    <p>Welcome to <strong style="color:#60a5fa">EduGuard DBT Monitoring System</strong>!</p>
    <p>Your account has been successfully created.</p>

    <div style="background:#1a1d27;border-radius:10px;padding:16px 20px;margin:20px 0;border:1px solid #2a2f3e">
      <table style="width:100%;border-collapse:collapse;color:#c4c9d4;font-size:13px">
        <tr><td style="padding:6px 0;color:#6b7280">User ID</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:#fff">{user_id}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Registration Date</td><td style="padding:6px 0;text-align:right;color:#fff">{datetime.utcnow().strftime('%d %b %Y')}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Status</td><td style="padding:6px 0;text-align:right"><span style="background:#065f46;color:#34d399;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">ACTIVE</span></td></tr>
      </table>
    </div>

    <p><strong>Next steps:</strong></p>
    <ol style="margin:0;padding-left:20px;color:#9ca3af">
      <li style="margin-bottom:6px">Complete your profile with personal details</li>
      <li style="margin-bottom:6px">Take a selfie for identity verification</li>
      <li style="margin-bottom:6px">Complete KYC to activate scheme benefits</li>
    </ol>
    """
    return _send_email(to_email, "Welcome to EduGuard — Account Created", _base_template("Welcome to EduGuard", body))


def send_magic_link_email(to_email: str, name: str, link_url: str) -> bool:
    """Send magic link for email verification and profile completion."""
    body = f"""
    <p style="margin:0 0 16px">Hello <strong style="color:#fff">{name}</strong>,</p>
    <p>Please verify your email address to log in and complete your <strong style="color:#60a5fa">EduGuard</strong> profile.</p>

    <div style="text-align:center; margin:32px 0;">
      <a href="{link_url}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;font-size:15px;letter-spacing:0.5px">
        Verify Email & Complete Profile
      </a>
    </div>

    <p style="color:#9ca3af;font-size:12px">This link will expire in 15 minutes. If you did not request this, you can safely ignore this email.</p>
    """
    return _send_email(to_email, "EduGuard — Verify Your Email", _base_template("Verify Your Email", body))


def send_profile_complete_email(to_email: str, name: str, district: str) -> bool:
    """Send confirmation after profile completion."""
    body = f"""
    <p style="margin:0 0 16px">Hello <strong style="color:#fff">{name}</strong>,</p>
    <p>Your profile has been <strong style="color:#34d399">successfully completed</strong>.</p>

    <div style="background:#1a1d27;border-radius:10px;padding:16px 20px;margin:20px 0;border:1px solid #2a2f3e">
      <table style="width:100%;border-collapse:collapse;color:#c4c9d4;font-size:13px">
        <tr><td style="padding:6px 0;color:#6b7280">District</td><td style="padding:6px 0;text-align:right;color:#fff">{district}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Face ID</td><td style="padding:6px 0;text-align:right"><span style="background:#065f46;color:#34d399;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">ENROLLED</span></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Profile Status</td><td style="padding:6px 0;text-align:right"><span style="background:#065f46;color:#34d399;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">COMPLETE</span></td></tr>
      </table>
    </div>

    <p>You can now proceed to complete your <strong style="color:#60a5fa">KYC verification</strong> to activate scheme benefits.</p>
    """
    return _send_email(to_email, "EduGuard — Profile Completed Successfully", _base_template("Profile Completed", body))


def send_kyc_result_email(to_email: str, name: str, success: bool, confidence: float) -> bool:
    """Send KYC verification result."""
    if success:
        status_badge = '<span style="background:#065f46;color:#34d399;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">VERIFIED</span>'
        message = "Your identity has been <strong style=\"color:#34d399\">successfully verified</strong> via face recognition."
    else:
        status_badge = '<span style="background:#7f1d1d;color:#f87171;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">FAILED</span>'
        message = "Face verification <strong style=\"color:#f87171\">did not match</strong>. Please try again or contact your DFO."

    body = f"""
    <p style="margin:0 0 16px">Hello <strong style="color:#fff">{name}</strong>,</p>
    <p>{message}</p>

    <div style="background:#1a1d27;border-radius:10px;padding:16px 20px;margin:20px 0;border:1px solid #2a2f3e">
      <table style="width:100%;border-collapse:collapse;color:#c4c9d4;font-size:13px">
        <tr><td style="padding:6px 0;color:#6b7280">Verification</td><td style="padding:6px 0;text-align:right">{status_badge}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">AI Confidence</td><td style="padding:6px 0;text-align:right;color:#fff;font-family:monospace">{confidence:.1f}%</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Timestamp</td><td style="padding:6px 0;text-align:right;color:#fff">{datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Method</td><td style="padding:6px 0;text-align:right;color:#fff">Multi-metric Face Analysis</td></tr>
      </table>
    </div>
    """
    subject = "EduGuard — KYC Verification " + ("Successful" if success else "Failed")
    return _send_email(to_email, subject, _base_template("KYC Verification Result", body))


def send_flag_assignment_email(to_email: str, verifier_name: str, case_id: str,
                                beneficiary_name: str, leakage_type: str, risk_score: int) -> bool:
    """Notify verifier of a new case assignment."""
    body = f"""
    <p style="margin:0 0 16px">Hello <strong style="color:#fff">{verifier_name}</strong>,</p>
    <p>A new case has been <strong style="color:#f59e0b">assigned to you</strong> for field verification.</p>

    <div style="background:#1a1d27;border-radius:10px;padding:16px 20px;margin:20px 0;border:1px solid #2a2f3e">
      <table style="width:100%;border-collapse:collapse;color:#c4c9d4;font-size:13px">
        <tr><td style="padding:6px 0;color:#6b7280">Case ID</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:#fff">{case_id}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Beneficiary</td><td style="padding:6px 0;text-align:right;color:#fff">{beneficiary_name}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Anomaly Type</td><td style="padding:6px 0;text-align:right;color:#f59e0b">{leakage_type}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Risk Score</td><td style="padding:6px 0;text-align:right;color:#ef4444;font-weight:700">{risk_score}/100</td></tr>
      </table>
    </div>

    <p>Please complete the field verification at the earliest.</p>
    """
    return _send_email(to_email, f"EduGuard — New Case Assigned: {case_id}", _base_template("Case Assignment", body))
