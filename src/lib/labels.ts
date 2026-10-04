import type {
  ContractStatus,
  EngagementModel,
  ExpenseCategory,
  ProjectRole,
  ProjectStatus,
} from "@/generated/prisma/enums";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

export const projectRoleLabels: Record<ProjectRole, string> = {
  STORE_KEEPER: "Store Keeper",
  FOREMAN: "Foreman",
  ENGINEER: "Engineer",
  BUILDER: "Builder",
  AID: "Aid",
};

export const engagementModels: Record<EngagementModel, { label: string; description: string }> = {
  FULL_MANAGEMENT: {
    label: "Full management",
    description:
      "They manage everything for an agreed total budget: materials, labor and execution. You follow progress.",
  },
  OWNER_FUNDS: {
    label: "I fund materials & labor",
    description:
      "They run the work day to day, but request materials and workers from you, and you pay for them.",
  },
};

export const contractStatusLabels: Record<ContractStatus, string> = {
  PENDING: "Awaiting response",
  ACTIVE: "Active",
  DECLINED: "Declined",
  ENDED: "Ended",
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  MATERIALS: "Materials",
  LABOR: "Labor",
  TRANSPORT: "Transport",
  EQUIPMENT: "Equipment",
  PERMITS: "Permits & fees",
  OTHER: "Other",
};

export const currencies = ["RWF", "USD", "EUR", "KES", "UGX", "TZS", "BIF"];

/** Categories every account that manages workers starts with; editable afterwards. */
export const defaultWorkerCategories = ["Engineer", "Foreman", "Store Keeper", "Builder / Mason", "Aid / Helper"];
