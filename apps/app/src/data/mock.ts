import type { Appointment, Professional } from '../types'

/** atendimento de exemplo: o dia e o cadastro da cliente são acrescentados pelo AgendaProvider */
export type MockAppointment = Pick<Appointment, 'id' | 'professionalId' | 'client' | 'service' | 'start' | 'duration' | 'price' | 'status'>

export const professionals: Professional[] = [
  { id: 'ana', name: 'Ana Clara', role: 'Nail Designer' },
  { id: 'bia', name: 'Bia Souza', role: 'Lash Design' },
  { id: 'carla', name: 'Carla Mendes', role: 'Cabelereira' },
]

const t = (h: number, m = 0) => h * 60 + m

export const appointments: MockAppointment[] = [
  { id: '1', professionalId: 'ana', client: 'Juliana Prado', service: 'Alongamento em gel', start: t(9), duration: 120, price: 220, status: 'concluido' },
  { id: '2', professionalId: 'ana', client: 'Marina Costa', service: 'Esmaltação em gel', start: t(11, 30), duration: 60, price: 90, status: 'atendimento' },
  { id: '3', professionalId: 'ana', client: 'Patrícia Lima', service: 'Manutenção de unhas', start: t(13, 30), duration: 90, price: 150, status: 'confirmado' },
  { id: '4', professionalId: 'ana', client: 'Fernanda Rocha', service: 'Nail art', start: t(16), duration: 60, price: 110, status: 'pendente' },
  { id: '5', professionalId: 'bia', client: 'Camila Duarte', service: 'Fio a fio', start: t(9, 30), duration: 120, price: 260, status: 'concluido' },
  { id: '6', professionalId: 'bia', client: 'Larissa Nunes', service: 'Lash lifting', start: t(12), duration: 75, price: 180, status: 'confirmado' },
  { id: '7', professionalId: 'bia', client: 'Beatriz Alves', service: 'Manutenção de cílios', start: t(14, 30), duration: 60, price: 120, status: 'confirmado' },
  { id: '8', professionalId: 'bia', client: 'Renata Gomes', service: 'Design de sobrancelha', start: t(17), duration: 45, price: 70, status: 'pendente' },
  { id: '9', professionalId: 'carla', client: 'Luciana Teixeira', service: 'Corte + escova', start: t(10), duration: 90, price: 160, status: 'concluido' },
  { id: '10', professionalId: 'carla', client: 'Aline Barros', service: 'Coloração', start: t(12), duration: 150, price: 380, status: 'atendimento' },
  { id: '11', professionalId: 'carla', client: 'Sofia Martins', service: 'Hidratação profunda', start: t(15), duration: 60, price: 130, status: 'confirmado' },
  { id: '12', professionalId: 'carla', client: 'Débora Freitas', service: 'Escova modelada', start: t(16, 30), duration: 60, price: 90, status: 'confirmado' },
]
