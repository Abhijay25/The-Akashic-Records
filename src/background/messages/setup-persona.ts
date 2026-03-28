import type { PlasmoMessaging } from "@plasmohq/messaging"
import { parseResume } from "~utils/resume-parser"
import { vaultStore } from "~utils/vault"
import type { SetupPersonaRequest, SetupPersonaResponse } from "~types/messages"

const handler: PlasmoMessaging.MessageHandler<
  SetupPersonaRequest,
  SetupPersonaResponse
> = async (req, res) => {
  const body = req.body

  if (!body?.resumeText || !body?.email || !body?.passphrase) {
    res.send({ success: false, error: "Missing required fields: resumeText, email, passphrase" })
    return
  }

  if (body.passphrase.length < 8) {
    res.send({ success: false, error: "Passphrase must be at least 8 characters" })
    return
  }

  try {
    const persona = await parseResume(body.resumeText, body.email)
    await vaultStore(persona, body.passphrase)
    res.send({ success: true, persona })
  } catch (err) {
    console.error("[setup-persona] failed:", err)
    res.send({ success: false, error: String(err) })
  }
}

export default handler
