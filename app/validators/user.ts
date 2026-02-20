import vine from '@vinejs/vine'

// Ta liste blanche : SEULS ces domaines peuvent s'inscrire
const ALLOWED_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'live.fr',
  'icloud.com',
  'eduvaud.ch',
  'yahoo.com',
  'yahoo.fr'
]

export const registerValidator = vine.compile(
  vine.object({
    username: vine.string().trim().minLength(3).maxLength(20),
    email: vine
      .string()
      .email()
      .normalizeEmail()
      .transform((value, field) => {
        const domain = value.split('@')[1]
        
        // Si le domaine n'est PAS dans la liste autorisée
        if (!ALLOWED_DOMAINS.includes(domain)) {
          field.report(
            "Seuls les emails non temporaires sont autorisés !",
            'allowedDomains', 
            field
          )
        }
        
        return value
      }),
    password: vine.string().minLength(8),
  })
)