import { generateToken, readToken, setFirstRunPending, writeToken } from '../utils/authToken'

export default defineNitroPlugin(() => {
  if (readToken() === null) {
    writeToken(generateToken())
    setFirstRunPending()
  }
})
