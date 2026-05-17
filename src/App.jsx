import { useState, useRef } from "react";
import { STEPS } from "./data/steps.js";
import { STEPS as STEPS_KO } from "./data/steps.ko.js";
import StepView from "./components/StepView.jsx";
import ReportScreen from "./components/ReportScreen.jsx";

export default function App() {
  const [lang, setLang] = useState("en");
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState([]);
  const timerRef = useRef(null);

  const steps = lang === "ko" ? STEPS_KO : STEPS;

  const handleSelect = (opt, idx) => {
    if (selected !== null) return;
    setSelected(idx);
    const newAnswers = [
      ...answers.filter(a => a.step !== steps[stepIndex].id),
      { step: steps[stepIndex].id, optionIndex: idx },
    ];
    setAnswers(newAnswers);
    setToast(opt.interp);
    timerRef.current = setTimeout(() => {
      setToast(null);
      if (stepIndex < steps.length - 1) {
        setStepIndex(s => s + 1);
        setSelected(null);
      } else {
        setDone(true);
      }
    }, 2400);
  };

  const navigateTo = (index) => {
    clearTimeout(timerRef.current);
    setStepIndex(index);
    setSelected(null);
    setToast(null);
    setDone(false);
  };

  const reset = () => {
    clearTimeout(timerRef.current);
    setStepIndex(0); setSelected(null);
    setToast(null); setDone(false); setAnswers([]);
  };

  if (done) return (
    <ReportScreen answers={answers} onReset={reset} onNavigate={navigateTo} stepIndex={-1} lang={lang} setLang={setLang} steps={steps} />
  );

  return (
    <StepView
      step={steps[stepIndex]}
      stepIndex={stepIndex}
      total={steps.length}
      onSelect={handleSelect}
      selected={selected}
      toast={toast}
      answers={answers}
      onNavigate={navigateTo}
      lang={lang}
      setLang={setLang}
      steps={steps}
    />
  );
}
