export async function getEdgeFunctionErrorMessage(error: any): Promise<string> {
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch {}
  }
  return error?.message || "Erro desconhecido";
}
