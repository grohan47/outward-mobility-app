"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const AVAILABLE_FORM_FIELDS = [
  { id: "full_name", label: "Full Name" },
  { id: "student_id", label: "Student ID" },
  { id: "email", label: "Email Address" },
  { id: "phone", label: "Phone Number" },
  { id: "program", label: "Academic Program" },
  { id: "cgpa", label: "Current CGPA" },
  { id: "course_applied_for", label: "Course Applied For" },
  { id: "sop", label: "Statement of Purpose (Text)" },
  { id: "transcript_upload", label: "Transcript (Upload)" },
  { id: "recommendation_upload", label: "Letter of Recommendation (Upload)" },
];

export default function NewOpportunityPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  // Step 1 Data
  const [oppData, setOppData] = useState({
    code: "", title: "", description: "", term: "", destination: "", deadline: "", seats: 0
  });
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  // Step 2 Data
  const [workflowSteps, setWorkflowSteps] = useState([
    {
      name: "Review Step 1",
      reviewerEmail: "",
      reviewerName: "",
      visibleFields: [] as string[],
      requiredInputs: [] as { id: string; label: string }[],
    }
  ]);

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    );
  };

  const toggleVisibleField = (stepIndex: number, fieldId: string) => {
    setWorkflowSteps(prev => {
      const newSteps = [...prev];
      const step = newSteps[stepIndex];
      if (step.visibleFields.includes(fieldId)) {
        step.visibleFields = step.visibleFields.filter(f => f !== fieldId);
      } else {
        step.visibleFields.push(fieldId);
      }
      return newSteps;
    });
  };

  const addWorkflowStep = () => {
    setWorkflowSteps(prev => [
      ...prev, 
      {
        name: `Review Step ${prev.length + 1}`,
        reviewerEmail: "",
        reviewerName: "",
        visibleFields: [],
        requiredInputs: [],
      }
    ]);
  };

  const removeWorkflowStep = (idx: number) => {
    setWorkflowSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const addRequiredInput = (stepIndex: number) => {
    setWorkflowSteps(prev => {
      const newSteps = [...prev];
      newSteps[stepIndex].requiredInputs.push({ 
        id: `input_${Date.now()}`, 
        label: "New Required Input" 
      });
      return newSteps;
    });
  };

  const updateRequiredInput = (stepIndex: number, inputIndex: number, value: string) => {
    setWorkflowSteps(prev => {
      const newSteps = [...prev];
      newSteps[stepIndex].requiredInputs[inputIndex].label = value;
      return newSteps;
    });
  };

  const submitForm = async () => {
    setLoading(true);
    try {
      const payload = {
        opportunity: oppData,
        formFields: selectedFields,
        workflowSteps: workflowSteps
      };

      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to create opportunity");
      router.push("/admin/opportunities");
    } catch (err) {
      console.error(err);
      alert("Error creating opportunity.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-semibold text-slate-900">Define New Opportunity & Workflow</h1>
        <p className="text-slate-500 mt-2">Create an application and configure its approval chain.</p>
      </div>

      <div className="flex gap-4 mb-8">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-slate-200'}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-slate-200'}`} />
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-medium mb-4">1. Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input type="text" className="w-full border rounded-lg p-2" placeholder="e.g. NUS_FALL" value={oppData.code} onChange={e => setOppData({...oppData, code: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input type="text" className="w-full border rounded-lg p-2" placeholder="e.g. NUS Exchange" value={oppData.title} onChange={e => setOppData({...oppData, title: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="w-full border rounded-lg p-2" rows={3} value={oppData.description} onChange={e => setOppData({...oppData, description: e.target.value})}></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Destination</label>
                <input type="text" className="w-full border rounded-lg p-2" value={oppData.destination} onChange={e => setOppData({...oppData, destination: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Term</label>
                <input type="text" className="w-full border rounded-lg p-2" value={oppData.term} onChange={e => setOppData({...oppData, term: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Deadline</label>
                <input type="date" className="w-full border rounded-lg p-2" value={oppData.deadline} onChange={e => setOppData({...oppData, deadline: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Available Seats</label>
                <input type="number" className="w-full border rounded-lg p-2" value={oppData.seats} onChange={e => setOppData({...oppData, seats: parseInt(e.target.value)})} />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-medium mb-1">2. Form Fields for Generator</h2>
            <p className="text-slate-500 text-sm mb-4">Select the exact data points the student must provide.</p>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_FORM_FIELDS.map(f => (
                <label key={f.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${selectedFields.includes(f.id) ? 'border-primary bg-primary/5' : 'hover:bg-slate-50'}`}>
                  <input type="checkbox" className="mr-3 w-4 h-4 text-primary" checked={selectedFields.includes(f.id)} onChange={() => toggleField(f.id)} />
                  {f.label}
                </label>
              ))}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={selectedFields.length === 0 || !oppData.title || !oppData.code}>Next: Define Workflow</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-medium mb-4">3. Workflow Editor</h2>
            <p className="text-slate-500 text-sm mb-6">Define the sequential validation chain. Each node represents an audit gate.</p>

            <div className="space-y-6">
              {workflowSteps.map((ws, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                  <div className="flex justify-between items-center mb-4">
                    <input type="text" className="text-lg font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none px-1 py-0.5" value={ws.name} onChange={e => {
                      const newSteps = [...workflowSteps];
                      newSteps[idx].name = e.target.value;
                      setWorkflowSteps(newSteps);
                    }} />
                    {workflowSteps.length > 1 && (
                      <button onClick={() => removeWorkflowStep(idx)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove Step</button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Reviewer Email</label>
                      <input type="email" placeholder="reviewer@univ.edu" className="w-full border rounded-lg p-2 text-sm" value={ws.reviewerEmail} onChange={e => {
                        const newSteps = [...workflowSteps];
                        newSteps[idx].reviewerEmail = e.target.value;
                        setWorkflowSteps(newSteps);
                      }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Reviewer Name & Role</label>
                      <input type="text" placeholder="e.g. Program Chair" className="w-full border rounded-lg p-2 text-sm" value={ws.reviewerName} onChange={e => {
                        const newSteps = [...workflowSteps];
                        newSteps[idx].reviewerName = e.target.value;
                        setWorkflowSteps(newSteps);
                      }} />
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Visibility (Fields they can see)</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedFields.length === 0 && <span className="text-sm text-slate-400 italic">No fields selected in Step 1.</span>}
                      {AVAILABLE_FORM_FIELDS.filter(f => selectedFields.includes(f.id)).map(f => (
                        <button key={f.id} onClick={() => toggleVisibleField(idx, f.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${ws.visibleFields.includes(f.id) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Required Inputs from Reviewer</label>
                      <button onClick={() => addRequiredInput(idx)} className="text-primary hover:text-primary-dark text-xs font-medium">
                        + Add Input Box
                      </button>
                    </div>
                    {ws.requiredInputs.length === 0 && <span className="text-sm text-slate-400 italic">No custom inputs required.</span>}
                    <div className="space-y-2">
                      {ws.requiredInputs.map((input, inputIdx) => (
                        <div key={input.id} className="flex gap-2">
                          <input type="text" placeholder="e.g. Funding Approved Amount" className="flex-1 border border-slate-200 rounded-md p-2 text-sm" value={input.label} onChange={e => updateRequiredInput(idx, inputIdx, e.target.value)} />
                          <button onClick={() => {
                            const newSteps = [...workflowSteps];
                            newSteps[idx].requiredInputs = newSteps[idx].requiredInputs.filter((_, i) => i !== inputIdx);
                            setWorkflowSteps(newSteps);
                          }} className="p-2 text-slate-400 hover:text-red-500">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="secondary" className="w-full mt-4" onClick={addWorkflowStep}>
              <span className="material-symbols-outlined mr-2">add</span> Add Workflow Node
            </Button>
          </Card>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={submitForm} disabled={loading}>{loading ? "Saving..." : "Create & Publish"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
