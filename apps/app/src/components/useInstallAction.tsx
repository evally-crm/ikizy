import { useState } from 'react'
import { promptInstall, useInstall } from '../lib/install'
import { InstallStepsDialog } from './InstallApp'

/** botão de instalar que serve para os dois casos: abre o pedido do navegador ou, sem ele, o passo a passo */
export function useInstallAction(onInstalled?: () => void) {
  const info = useInstall()
  const [steps, setSteps] = useState(false)
  // sempre dá para instalar: pelo pedido do navegador, ou pelo passo a passo quando ele não oferece
  const available = !info.installed
  const run = async () => {
    if (info.canPrompt) {
      if (await promptInstall()) onInstalled?.()
    } else setSteps(true)
  }
  return { info, available, run, dialog: steps ? <InstallStepsDialog ios={info.needsSteps} onClose={() => setSteps(false)} /> : null }
}
