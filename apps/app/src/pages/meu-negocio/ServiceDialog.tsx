import { useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { CATEGORIES, type Category, type Product, type Service } from '../../data/catalog'
import type { ServiceInput } from '../../data/business'
import { formatDuration } from '../../lib/agendaTime'
import { toMoneyInput } from '../../lib/format'
import { MoneyField, Select, Stepper, parseMoney } from '../../components/controls'
import { Modal } from '../../components/Modal'
import { Button, Em } from '../../components/ui'
import './MeuNegocio.css'

/** cria ou edita um serviço (o que aparece no site fica no Meu site) */
export function ServiceDialog({
  service,
  products,
  onSave,
  onRemove,
  onClose,
}: {
  service: Service | null
  products: Product[]
  onSave: (input: ServiceInput) => Promise<string | null>
  onRemove?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(service?.name ?? '')
  const [category, setCategory] = useState<Category>(service?.category ?? 'Unhas')
  const [price, setPrice] = useState(toMoneyInput(service?.price ?? 0))
  const [duration, setDuration] = useState(service?.duration ?? 60)
  const [productId, setProductId] = useState(service?.productId ?? '')
  const [volume, setVolume] = useState(String(service?.monthlyVolume ?? 0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const message = await onSave({
      name,
      category,
      price: parseMoney(price),
      duration,
      productId: productId || null,
      monthlyVolume: Number(volume) || 0,
    })
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label={service ? 'Editar serviço' : 'Novo serviço'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog__head">
          <h2>
            {service ? 'Editar' : 'Novo'} <Em>serviço</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="form">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoFocus={!service} placeholder="Ex.: Esmaltação em gel" />
            </span>
          </label>
          <Select label="Categoria" value={category} options={CATEGORIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setCategory(v as Category)} />
          <div className="form__pair">
            <MoneyField label="Preço" value={price} onChange={setPrice} />
            <Stepper label="Duração" value={duration} onChange={setDuration} format={formatDuration} min={5} max={600} step={15} />
          </div>
          <details className="bizdialog__more" open={Boolean(service?.productId)}>
            <summary>Custo de material (opcional)</summary>
            <p className="field__hint">Para calcular quanto sobra de cada atendimento. Cadastre os materiais na aba Materiais.</p>
            <div className="form__pair">
              <Select
                label="Material usado"
                value={productId}
                options={[{ value: '', label: 'Nenhum' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
                onChange={setProductId}
              />
              <label className="field">
                <span className="field__label">Atendimentos por mês</span>
                <span className="input">
                  <input type="number" inputMode="numeric" min={0} value={volume} onChange={(e) => setVolume(e.target.value)} />
                </span>
              </label>
            </div>
          </details>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          {onRemove ? (
            <Button variant="light" onClick={onRemove}>
              <Trash2 size={16} aria-hidden="true" /> Apagar
            </Button>
          ) : (
            <Button variant="light" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
