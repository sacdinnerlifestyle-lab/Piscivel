export type Status = "agendada" | "em_andamento" | "concluida";
export interface Visit {
  id: string; client: string; phone: string; address: string; time: string;
  tech: string; status: Status; pool: string; volume: number; day: number;
}
export const techs = ["Rafael Lima", "Bruna Costa", "Diego Alves"];
export const visits: Visit[] = [
  { id: "1", client: "Residencial Sol Nascente", phone: "5511987654321", address: "Rua das Palmeiras, 120 – Alphaville", time: "08:00", tech: "Rafael Lima", status: "concluida", pool: "Vinil", volume: 42, day: 0 },
  { id: "2", client: "Família Andrade", phone: "5511912345678", address: "Av. Brasil, 845 – Jardins", time: "09:30", tech: "Rafael Lima", status: "em_andamento", pool: "Pastilha", volume: 28, day: 0 },
  { id: "3", client: "Hotel Mar Azul", phone: "5511998877665", address: "Rua Atlântica, 50 – Centro", time: "11:00", tech: "Bruna Costa", status: "agendada", pool: "Fibra", volume: 120, day: 0 },
  { id: "4", client: "Condomínio Vista Verde", phone: "5511955554444", address: "Al. dos Ipês, 300 – Morumbi", time: "14:00", tech: "Rafael Lima", status: "agendada", pool: "Azulejo", volume: 85, day: 0 },
  { id: "5", client: "Clube Atlético Brisa", phone: "5511933332222", address: "Rua do Lago, 9 – Moema", time: "15:30", tech: "Diego Alves", status: "agendada", pool: "Concreto", volume: 300, day: 0 },
  { id: "6", client: "Casa Oliveira", phone: "5511944443333", address: "Rua Flores, 77 – Granja Viana", time: "08:30", tech: "Bruna Costa", status: "agendada", pool: "Vinil", volume: 35, day: 1 },
  { id: "7", client: "Academia Fluir", phone: "5511966665555", address: "Av. Paulista, 1500", time: "10:00", tech: "Diego Alves", status: "agendada", pool: "Pastilha", volume: 60, day: 2 },
  { id: "8", client: "Família Souza", phone: "5511977776666", address: "Rua Aurora, 12 – Tamboré", time: "13:00", tech: "Rafael Lima", status: "agendada", pool: "Fibra", volume: 22, day: 3 },
];
export const statusLabel: Record<Status, string> = { agendada: "Agendada", em_andamento: "Em andamento", concluida: "Concluída" };
export const params = [
  { key: "ph", label: "pH", min: 7.2, max: 7.6, unit: "", step: 0.1 },
  { key: "cl", label: "Cloro Livre", min: 1, max: 3, unit: "ppm", step: 0.1 },
  { key: "alk", label: "Alcalinidade Total", min: 80, max: 120, unit: "ppm", step: 1 },
  { key: "cya", label: "Ácido Cianúrico", min: 30, max: 50, unit: "ppm", step: 1 },
] as const;
