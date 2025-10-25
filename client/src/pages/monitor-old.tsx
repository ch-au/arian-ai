import { useRoute } from "wouter";

export default function Monitor() {
  const [match, params] = useRoute("/monitor/:id");
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Monitor Simulation</h1>
        <p className="text-gray-600 mt-2">
          {match ? `Monitoring negotiation: ${params?.id}` : "Real-time simulation monitoring and progress tracking"}
        </p>
      </div>
      <div className="p-12 border-2 border-dashed border-gray-200 rounded-lg text-center bg-gray-50/50">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <h3 className="text-xl font-semibold mb-2 text-gray-900">Simulation Monitor</h3>
          <p className="text-gray-600">Real-time progress tracking, radar charts, conversation logs, and simulation controls will be implemented here.</p>
        </div>
      </div>
    </div>
  );
}