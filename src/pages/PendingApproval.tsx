import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";

export default function PendingApproval() {
  const { signOut, status } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
            <Clock className="h-6 w-6 text-warning" />
          </div>
          <CardTitle>
            {status === "bloqueado" ? "Acesso Bloqueado" : "Aguardando Aprovação"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {status === "bloqueado"
              ? "Seu acesso foi bloqueado pelo administrador. Entre em contato para mais informações."
              : "Seu cadastro foi realizado com sucesso! O administrador precisa aprovar seu acesso antes que você possa utilizar o sistema."}
          </p>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
