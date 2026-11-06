// Module catalog for the prototype. `status` must tell the truth (Master Plan §6:
// unfinished modules are never presented as complete).
export type ModuleStatus = "prototype" | "planned";

export interface ModuleInfo {
  id: string;
  name: string;
  status: ModuleStatus;
  stage: string;
  note: string;
}

export const MODULES: ModuleInfo[] = [
  { id: "notes", name: "Note de test", status: "prototype", stage: "Etapa 0", note: "Salvare reală prin motorul S1" },
  { id: "storage", name: "Stare stocare", status: "prototype", stage: "Etapa 0", note: "Date reale din motorul S1" },
  { id: "devices", name: "Dispozitive și sincronizare", status: "planned", stage: "Etapa 6", note: "Rețeaua (S2) e testată separat, nelegată de această fereastră" },
  { id: "documents", name: "Document Studio", status: "planned", stage: "Etapa 3", note: "Neînceput" },
  { id: "sheets", name: "Foi de calcul", status: "planned", stage: "Etapa 3", note: "Neînceput" },
  { id: "tasks", name: "Taskuri și reminder", status: "planned", stage: "Etapa 4", note: "Neînceput" },
  { id: "business", name: "Business (facturi, stocuri)", status: "planned", stage: "Etapa 5", note: "Neînceput" },
  { id: "news", name: "InfoNews", status: "planned", stage: "Etapa 7", note: "Neînceput" },
];
