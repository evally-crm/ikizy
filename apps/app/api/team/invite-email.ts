import { parseInviteEmailInput, sendInviteEmail } from '../_lib/inviteEmail.js'
import { appUrl, authenticate, createInviteEmailDb, emailSender, fail, json } from '../_lib/runtime.js'

/** POST { inviteId } -> { sentTo } · manda (ou reenvia) o convite da equipe por e-mail; só a dona do salão */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request)
    const input = parseInviteEmailInput(await request.json().catch(() => null))
    const result = await sendInviteEmail({ db: createInviteEmailDb(), send: emailSender(), appUrl: appUrl() }, user, input)
    return json(result)
  } catch (error) {
    return fail(error)
  }
}
