import { Card } from "@/components/ui/Card";

export default function GeneratorMessagesWipPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Messaging (WIP)</h1>
        <p className="text-slate-500 mt-2">Messaging UI is reserved for the next iteration.</p>
      </div>

      <Card className="border border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600">construction</span>
          <div>
            <p className="font-bold text-amber-900">Work in Progress</p>
            <p className="text-sm text-amber-800 mt-1">
              Use application comments for review communication. Dedicated chat remains marked WIP.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
