import vine from '@vinejs/vine'

const ALLOWED_DOMAINS = [
  'icloud.com',
  'me.com',
  'mac.com',

  // --- PROTON MAIL ---
  'proton.me',
  'protonmail.com',
  'protonmail.ch',
  'pm.me',

  // --- LE TOP MONDIAL ---
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'aim.com',
  'msn.com',
  'ymail.com',
  'mail.com',
  'rocketmail.com',

  // --- FRANCE (Le gros de tes users) ---
  'hotmail.fr',
  'yahoo.fr',
  'live.fr',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'neuf.fr',
  'laposte.net',
  'voila.fr',
  'aliceadsl.fr',
  'club-internet.fr',
  'numericable.fr',
  'bbox.fr',

  // --- SUISSE (Important pour toi !) ---
  'bluewin.ch',
  'eduvaud.ch',
  'hispeed.ch',
  'sunrise.ch',
  'gmx.ch',

  // --- EUROPE (UK, DE, IT, ES, BE, NL) ---
  'hotmail.co.uk',
  'live.co.uk',
  'yahoo.co.uk',
  'sky.com',
  'virginmedia.com',
  'gmx.de',
  'web.de',
  't-online.de',
  'freenet.de',
  'arcor.de',
  'hotmail.it',
  'live.it',
  'yahoo.it',
  'alice.it',
  'virgilio.it',
  'tin.it',
  'libero.it',
  'hotmail.es',
  'yahoo.es',
  'terra.es',
  'skynet.be',
  'telenet.be',
  'proximus.be',
  'live.nl',
  'home.nl',
  'planet.nl',
  'hetnet.nl',
  'zonnet.nl',
  'chello.nl',

  // --- AMÉRIQUES & RESTE DU MONDE ---
  'yahoo.com.br',
  'uol.com.br',
  'bol.com.br',
  'ig.com.br',
  'terra.com.br',
  'yahoo.com.ar',
  'yahoo.com.mx',
  'yahoo.ca',
  'sympatico.ca',
  'shaw.ca',
  'verizon.net',
  'comcast.net',
  'cox.net',
  'charter.net',
  'att.net',
  'bellsouth.net',
  'sbcglobal.net',
  'optonline.net',
  'earthlink.net',
  'yahoo.co.in',
  'rediffmail.com',
  'yahoo.in',
  'qq.com',
  'yahoo.co.jp',
  'yandex.ru',
  'mail.ru',
  'rambler.ru',
  'bigpond.com',
  'bigpond.net.au',
  'optusnet.com.au',
]

export const registerValidator = vine.compile(
  vine.object({
    username: vine.string().trim().minLength(3).maxLength(20),
    email: vine
      .string()
      .email()
      .transform((value, field) => {
        const lowerValue = value.toLowerCase()
        const [localPart, domain] = lowerValue.split('@')

        if (localPart.includes('+')) {
          field.report(
            "Les alias (contenant un '+') sont interdits. Utilise ton mail principal.",
            'noAlias',
            field
          )
          return lowerValue
        }

        if (!ALLOWED_DOMAINS.includes(domain)) {
          field.report(
            'Seuls les emails classiques (Gmail, Outlook, Yahoo...) sont autorisés.',
            'allowedDomains',
            field
          )
        }

        return lowerValue
      }),
    password: vine.string().minLength(8),
  })
)
