const { z } = require('zod');
const metaSchema = z.object({
  client_slug: z.string().min(1),
  site_slug: z.string().min(1),
  ydoc_serial: z.string().min(1),
  ts: z.string().min(1),
  level_m: z.number().finite(),
  battery_v: z.number().finite().optional(),
  temp_c: z.number().finite().optional(),
  reading_id: z.string().uuid().optional()
});
module.exports = { metaSchema };
