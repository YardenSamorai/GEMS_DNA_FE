/**
 * Pre-built email templates for the CRM broadcast editor.
 * All templates use inline CSS so they render correctly in every email client
 * (Gmail, Outlook, Apple Mail, etc.) — external CSS is stripped by most clients.
 *
 * Personalisation tags supported (replaced server-side per recipient):
 *   {{firstName}}  {{name}}  {{company}}  {{title}}
 */

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const wrap = (inner, { bg = "#f5f5f4" } = {}) => `
<div style="background:${bg};padding:24px 12px;font-family:${FONT};color:#1c1917;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.04);">
    <tr><td>${inner}</td></tr>
  </table>
  <p style="text-align:center;color:#a8a29e;font-size:11px;margin:18px 0 0;font-family:${FONT};">
    Sent with care · GEMS DNA
  </p>
</div>`;

export const EMAIL_TEMPLATES = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch",
    subject: "",
    html: wrap(`
      <div style="padding:32px 28px;">
        <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#44403c;">Hi {{firstName}},</p>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#44403c;">Write your message here…</p>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#44403c;">Best regards,<br>{{name}}</p>
      </div>
    `),
  },
  {
    id: "newStock",
    name: "New stock arrival",
    description: "Announce fresh inventory with a CTA",
    subject: "New arrivals you should see, {{firstName}}",
    html: wrap(`
      <div style="background:linear-gradient(135deg,#1c1917 0%,#44403c 100%);padding:42px 28px;text-align:center;color:#fafaf9;">
        <div style="display:inline-block;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d6d3d1;margin-bottom:14px;">Just arrived</div>
        <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:-0.5px;">Fresh selection in the vault</h1>
        <p style="margin:14px 0 0;font-size:15px;color:#e7e5e4;line-height:1.6;">Hand-picked pieces, hot off the certificate.</p>
      </div>
      <div style="padding:34px 28px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#44403c;">Hi {{firstName}},</p>
        <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#44403c;">
          We just received a curated selection that I think will catch your eye — including a few stones I had you in mind for. Take a look and let me know what speaks to you.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://gemsdna.com" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.2px;">View the collection →</a>
        </div>
        <p style="margin:24px 0 0;font-size:14px;color:#78716c;line-height:1.6;border-top:1px solid #e7e5e4;padding-top:18px;">
          Available exclusively to a short list of buyers. Reply to this email and I'll send you certs and videos.
        </p>
        <p style="margin:18px 0 0;font-size:15px;color:#44403c;">Warmly,<br><strong>{{name}}</strong></p>
      </div>
    `),
  },
  {
    id: "promo",
    name: "Promotion / Offer",
    description: "Time-limited deal with bold visuals",
    subject: "Exclusive offer for {{firstName}}",
    html: wrap(`
      <div style="background:#fef3c7;padding:18px 28px;text-align:center;border-bottom:3px solid #f59e0b;">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#92400e;font-weight:700;">Limited time</div>
      </div>
      <div style="padding:42px 28px;text-align:center;">
        <h1 style="margin:0 0 8px;font-size:38px;font-weight:800;letter-spacing:-1px;color:#1c1917;">Special pricing</h1>
        <p style="margin:0;font-size:16px;color:#78716c;">just for {{company}}</p>
        <div style="margin:30px auto;width:80px;height:3px;background:#f59e0b;border-radius:99px;"></div>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#44403c;max-width:440px;margin-left:auto;margin-right:auto;">
          Hi {{firstName}}, I've earmarked a few stones at preferred pricing for our top partners this month. First come, first served — let me know which interests you.
        </p>
        <div style="text-align:center;margin:30px 0;">
          <a href="https://gemsdna.com" style="display:inline-block;background:#f59e0b;color:#1c1917;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;">Reserve yours →</a>
        </div>
      </div>
      <div style="background:#fafaf9;padding:20px 28px;text-align:center;border-top:1px solid #e7e5e4;">
        <p style="margin:0;font-size:13px;color:#78716c;">Reply to this email or call directly. — {{name}}</p>
      </div>
    `, { bg: "#fafaf9" }),
  },
  {
    id: "newsletter",
    name: "Monthly newsletter",
    description: "Multi-section update with feature blocks",
    subject: "{{company}} update — what's new this month",
    html: wrap(`
      <div style="padding:32px 28px;border-bottom:1px solid #e7e5e4;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a8a29e;font-weight:600;">Monthly Brief</div>
        <h1 style="margin:6px 0 0;font-size:28px;font-weight:700;color:#1c1917;letter-spacing:-0.5px;">What's new at GEMS DNA</h1>
      </div>
      <div style="padding:28px 28px 8px;">
        <p style="margin:0;font-size:15px;line-height:1.65;color:#44403c;">Hi {{firstName}}, here's a quick roundup from our side this month.</p>
      </div>
      <div style="padding:0 28px 8px;">
        <div style="border-left:3px solid #1c1917;padding:6px 0 6px 16px;margin:20px 0;">
          <h3 style="margin:0 0 6px;font-size:18px;color:#1c1917;font-weight:700;">New inventory</h3>
          <p style="margin:0;font-size:14px;color:#57534e;line-height:1.6;">Over 40 new certified stones added this week — including notable pieces in fancy yellows and emerald cuts.</p>
        </div>
        <div style="border-left:3px solid #1c1917;padding:6px 0 6px 16px;margin:20px 0;">
          <h3 style="margin:0 0 6px;font-size:18px;color:#1c1917;font-weight:700;">Industry insight</h3>
          <p style="margin:0;font-size:14px;color:#57534e;line-height:1.6;">Demand for melee continues to rise. We're keeping a healthy buffer in 0.30–0.50ct ranges.</p>
        </div>
        <div style="border-left:3px solid #1c1917;padding:6px 0 6px 16px;margin:20px 0;">
          <h3 style="margin:0 0 6px;font-size:18px;color:#1c1917;font-weight:700;">From the bench</h3>
          <p style="margin:0;font-size:14px;color:#57534e;line-height:1.6;">A few signature jewelry pieces just landed — happy to share images on request.</p>
        </div>
      </div>
      <div style="padding:18px 28px 32px;text-align:center;border-top:1px solid #e7e5e4;margin-top:14px;">
        <a href="https://gemsdna.com" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">Browse the catalogue</a>
        <p style="margin:18px 0 0;font-size:13px;color:#78716c;">Until next month,<br><strong>{{name}}</strong></p>
      </div>
    `),
  },
  {
    id: "followUp",
    name: "Personal follow-up",
    description: "Warm, plain-text style for high-touch outreach",
    subject: "Following up, {{firstName}}",
    html: wrap(`
      <div style="padding:36px 32px;">
        <p style="margin:0 0 18px;font-size:17px;line-height:1.6;color:#1c1917;">Hi {{firstName}},</p>
        <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#44403c;">
          Hope all is well at {{company}}. I wanted to circle back on our last conversation and see if there's anything I can put in front of you.
        </p>
        <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#44403c;">
          If now isn't the right time, no problem at all — just let me know when works better and I'll plan around it.
        </p>
        <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#44403c;">
          Either way, always good to hear from you.
        </p>
        <p style="margin:24px 0 0;font-size:16px;color:#1c1917;">
          Best,<br><strong>{{name}}</strong>
        </p>
      </div>
    `),
  },
  {
    id: "thanks",
    name: "Thank you",
    description: "Quick gratitude / post-meeting note",
    subject: "Thanks, {{firstName}}",
    html: wrap(`
      <div style="background:#ecfdf5;padding:38px 28px;text-align:center;border-bottom:3px solid #10b981;">
        <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:#10b981;color:#ffffff;line-height:64px;font-size:32px;">★</div>
        <h1 style="margin:18px 0 6px;font-size:30px;font-weight:700;color:#064e3b;letter-spacing:-0.5px;">Thank you, {{firstName}}</h1>
        <p style="margin:0;font-size:15px;color:#047857;">Appreciate the time today.</p>
      </div>
      <div style="padding:32px 28px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#44403c;">
          Just a quick note to thank you for the conversation. I'll follow up shortly with the items we discussed and a few extras I thought you'd like.
        </p>
        <p style="margin:18px 0 0;font-size:16px;color:#1c1917;">Talk soon,<br><strong>{{name}}</strong></p>
      </div>
    `),
  },
];

/**
 * Reusable HTML "blocks" the user can insert into the editor at cursor position.
 */
export const EMAIL_BLOCKS = [
  {
    id: "heading",
    label: "Heading",
    html: `\n<h2 style="margin:24px 0 8px;font-size:24px;color:#1c1917;font-weight:700;letter-spacing:-0.3px;">Your heading here</h2>\n`,
  },
  {
    id: "paragraph",
    label: "Paragraph",
    html: `\n<p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#44403c;">Your paragraph text here. Speak directly to {{firstName}} for a personal touch.</p>\n`,
  },
  {
    id: "button",
    label: "Button",
    html: `\n<div style="text-align:center;margin:24px 0;">\n  <a href="https://gemsdna.com" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:10px;font-weight:600;font-size:15px;">Click here →</a>\n</div>\n`,
  },
  {
    id: "image",
    label: "Image",
    html: `\n<div style="text-align:center;margin:24px 0;">\n  <img src="https://via.placeholder.com/560x280/e7e5e4/78716c?text=Your+image+here" alt="" style="max-width:100%;border-radius:10px;display:block;margin:0 auto;" />\n</div>\n`,
  },
  {
    id: "divider",
    label: "Divider",
    html: `\n<hr style="border:none;border-top:1px solid #e7e5e4;margin:28px 0;" />\n`,
  },
  {
    id: "spacer",
    label: "Spacer",
    html: `\n<div style="height:32px;line-height:32px;">&nbsp;</div>\n`,
  },
  {
    id: "quote",
    label: "Quote",
    html: `\n<blockquote style="margin:24px 0;padding:14px 20px;border-left:4px solid #1c1917;background:#fafaf9;font-style:italic;color:#44403c;font-size:15px;line-height:1.6;">"Your testimonial or quote goes here." — Source</blockquote>\n`,
  },
  {
    id: "feature",
    label: "Feature row",
    html: `\n<div style="border-left:3px solid #1c1917;padding:6px 0 6px 16px;margin:20px 0;">\n  <h3 style="margin:0 0 6px;font-size:18px;color:#1c1917;font-weight:700;">Feature title</h3>\n  <p style="margin:0;font-size:14px;color:#57534e;line-height:1.6;">Short description of the feature or item.</p>\n</div>\n`,
  },
];

/**
 * Personalisation tags shown as one-click chips in the editor.
 */
export const PERSONALISATION_TAGS = [
  { tag: "{{firstName}}", label: "First name" },
  { tag: "{{name}}", label: "Full name" },
  { tag: "{{company}}", label: "Company" },
  { tag: "{{title}}", label: "Title" },
];

/**
 * Generate a plain-text fallback from HTML (for email clients that don't render HTML).
 */
export const htmlToPlainText = (html) => {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
