interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
}

interface Column {
  id: string;
  slug: string;
  label: string;
}

interface Member {
  user_id: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

interface Props {
  projectName: string;
  companyName: string;
  appName: string;
  logoUrl: string | null;
  tasks: Task[];
  columns: Column[];
  members: Member[];
}

const PRIORITY_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export default function PrintProjectView({
  projectName,
  companyName,
  appName,
  logoUrl,
  tasks,
  columns,
  members,
}: Props) {
  const memberName = (userId: string | null) => {
    if (!userId) return null;
    const m = members.find((mm) => mm.user_id === userId);
    return m?.profiles?.full_name || m?.profiles?.email || null;
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : null;

  return (
    <div className="print-area" style={{ display: "none" }}>
      <header
        style={{
          borderBottom: "2px solid #000",
          paddingBottom: 12,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {logoUrl && (
          <img src={logoUrl} alt="Logo" style={{ height: 40, width: 40, objectFit: "contain" }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#555" }}>
            {appName} {companyName ? `· ${companyName}` : ""}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{projectName}</h1>
        </div>
        <div style={{ fontSize: 10, color: "#555", textAlign: "right" }}>
          Gerado em<br />
          {new Date().toLocaleString("pt-BR")}
        </div>
      </header>

      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.slug);
        if (colTasks.length === 0) return null;
        return (
          <section key={col.id} className="print-column" style={{ marginBottom: 24 }}>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                borderBottom: "1px solid #000",
                paddingBottom: 4,
                marginBottom: 10,
              }}
            >
              {col.label} ({colTasks.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {colTasks.map((t) => {
                const assignee = memberName(t.assigned_to);
                const due = formatDate(t.due_date);
                return (
                  <div
                    key={t.id}
                    className="print-card"
                    style={{
                      border: "1px solid #999",
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{t.title}</div>
                    {t.description && (
                      <div style={{ color: "#333", marginBottom: 6, whiteSpace: "pre-wrap" }}>
                        {t.description}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 12, color: "#555", fontSize: 11, flexWrap: "wrap" }}>
                      <span>Prioridade: <strong>{PRIORITY_LABELS[t.priority] || t.priority}</strong></span>
                      {due && <span>Prazo: <strong>{due}</strong></span>}
                      {assignee && <span>Responsável: <strong>{assignee}</strong></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
