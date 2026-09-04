/* ==========================================================================
   WHATSAPP ORDERING
   --------------------------------------------------------------------------
   Builds https://wa.me/PHONE_NUMBER?text=MESSAGE links.
   The phone number comes from Admin -> Settings (site_settings table).
   Exposes: WA
   Depends on: js/config.js, js/utils.js
   ========================================================================== */

const WA = (function () {

  /* Keep digits only. Optionally fixes a leading 0 using the country code
     configured in js/config.js (whatsappCountryCode). */
  function cleanNumber(raw) {
    let digits = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
    const cc = String(SITE_CONFIG.whatsappCountryCode || '').replace(/[^0-9]/g, '');
    if (digits.length > 1 && digits.charAt(0) === '0' && cc) {
      digits = cc + digits.substring(1);
    }
    return digits;
  }

  function isValidNumber(raw) {
    const digits = cleanNumber(raw);
    return digits.length >= 10 && digits.length <= 15;
  }

  /* Build a WhatsApp link.
     - With a product: pre-fills the order message shown in the requirements.
     - Without a product: a general enquiry message. */
  function link(settings, product) {
    const number = cleanNumber(settings && settings.whatsapp_number);
    if (!number) return null;

    const lines = [];
    if (product) {
      lines.push('Hello, I am interested in buying ' + product.name + '.');
      lines.push('');
      lines.push('Product: ' + product.name);
      lines.push('Price: ' + U.money(product.price));
      if (product.id) lines.push('Product ID: ' + product.id);
      lines.push('');
      lines.push('Please provide more details.');
    } else {
      lines.push('Hello! I have a question about your products.');
    }

    return 'https://wa.me/' + number + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  /* Opens WhatsApp in a new tab. On mobile this opens the WhatsApp app. */
  function open(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return { cleanNumber, isValidNumber, link, open };
})();
