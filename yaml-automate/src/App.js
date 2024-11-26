import React, {useState, useEffect, useCallback} from "react";
import ReactFlow, {MiniMap, Controls, MarkerType} from "react-flow-renderer";
import {
  addEdge,
  Background,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from "reactflow";

class YAMLValidator {
  constructor(onStep) {
    this.stack = [];
    this.state = "START";
    this.isValid = true;
    this.errorMessage = "";
    this.isMultiline = false;
    this.multilineIndent = 0;
    this.onStep = onStep;
  }

  processLine(line, lineNumber) {
    line = line.trimEnd();
    const indentLevel = line.length - line.trimStart().length;


    if (!line || line.trimStart().startsWith("#")) {
      return;
    }

    if (this.isMultiline) {
      if (indentLevel >= this.multilineIndent) {
        return;
      } else {
        this.isMultiline = false;
      }
    }

    const keyValuePattern = /^\s*\w+:\s*(.*)$/;
    const sequenceItemPattern = /^\s*-\s+(.*)$/;
    const multilineStartPattern = /^\s*\w+:\s*[|>]\s*$/;

    try {
      if (multilineStartPattern.test(line)) {
        this.state = "MULTILINE_START";
        this.handleMultilineString(indentLevel, line, lineNumber);
      } else if (sequenceItemPattern.test(line)) {
        this.state = "SEQUENCE";
        this.handleSequence(indentLevel, line, lineNumber);
      } else if (keyValuePattern.test(line)) {
        this.state = "KEY_VALUE";
        this.handleKeyValue(indentLevel, line, lineNumber);
      } else {
        this.state = "INVALID";
        this.handleInvalidStructure(indentLevel, line, lineNumber);
      }
    } catch (error) {
      this.state = "INVALID";
      this.isValid = false;
      this.errorMessage = `Error at line ${lineNumber}: ${error.message}`;
    }

    this.onStep({
      state: this.state,
      stack: [...this.stack],
      line: lineNumber,
      content: line
    });
  }

  handleMultilineString(indentLevel, line, lineNumber) {
    this.isMultiline = true;
    this.multilineIndent = indentLevel;
    if (!line.split(":")[0].trim()) {
      throw new Error(`Invalid multiline string at line ${lineNumber}: Missing key`);
    }
    this.adjustStack(indentLevel, line, lineNumber, "MULTILINE_START");
  }

  handleSequence(indentLevel, line, lineNumber) {

    const sequenceContent = line.trimStart().substring(1).trim();


    this.adjustStack(indentLevel, line, lineNumber, "SEQUENCE");



    if (sequenceContent.includes(':')) {
      const nestedKvPattern = /^\s*\w+:\s*.*$/;
      if (!nestedKvPattern.test(sequenceContent)) {
        throw new Error(`Invalid sequence item: Incorrect nested key-value format`);
      }
    }
  }

  handleKeyValue(indentLevel, line, lineNumber) {

    const match = line.match(/^\s*(\w+):\s*(.*)$/);
    const key = match[1].trim();
    const value = match[2] ? match[2].trim() : null;


    this.adjustStack(indentLevel, line, lineNumber, "KEY_VALUE");


    if (!key) {
      throw new Error(`Missing key`);
    }


    if (value && value.startsWith('-')) {
      throw new Error(`Inline sequences are not allowed`);
    }
  }

  adjustStack(indentLevel, line, lineNumber, state) {
    if (!this.stack.length || indentLevel > this.stack[this.stack.length - 1].depth * 2) {
      this.stack.push({origin: line, depth: indentLevel / 2, state: state});
    } else if (indentLevel <= this.stack[this.stack.length - 1].depth * 2) {
      while (this.stack.length && indentLevel <= this.stack[this.stack.length - 1].depth * 2) {
        this.stack.pop();
      }
      this.stack.push({origin: line, depth: indentLevel / 2});
      this.onStep({
        state: "START",
        stack: [...this.stack],
        line: lineNumber,
        content: line
      });
    }
  }

  handleInvalidStructure(indentLevel, line, lineNumber) {

    throw new Error(`Unexpected line content`);
  }

  validateYAML(yamlContent) {
    const lines = yamlContent.split("\n");
    lines.forEach((line, index) => {
      this.processLine(line, index + 1);
    });
    return { isValid: this.isValid, errorMessage: this.errorMessage };
  }
}


const AutomatonGraph = ({ steps }) => {
  const initialNodes = [
    { id: "START", data: { label: "Start" }, position: { x: 200, y: 50 }, draggable: true },
    { id: "SEQUENCE", data: { label: "Sequence" }, position: { x: -100, y: 500 },draggable: true },
    { id: "KEY_VALUE", data: { label: "Key-Value" }, position: { x: 200, y: 200 },draggable: true },
    { id: "MULTILINE_START", data: { label: "Multiline Start" }, position: { x: 500, y: 500 }, draggable: true },
    { id: "INVALID", data: { label: "Invalid" }, position: { x: 200, y: 600 }, draggable: true },
  ];

  const markedEnd = {
    type: MarkerType.Arrow,
        color: '#555',
  }

  const pathOptions= {
    offset: 20
  }

  const initialEdges = [

    { id: "e1", source: "START", target: "SEQUENCE", label: "Process Sequence", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e2", source: "START", target: "KEY_VALUE", label: "Process Key-Value", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e3", source: "START", target: "MULTILINE_START", label: "Start Multiline", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e4", source: "START", target: "INVALID", label: "Invalid Syntax", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },


    { id: "e5", source: "SEQUENCE", target: "INVALID", label: "Error in Sequence", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e6", source: "SEQUENCE", target: "KEY_VALUE", label: "Nested Key-Value", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e7", source: "SEQUENCE", target: "SEQUENCE", label: "Continue Sequence", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },


    { id: "e15", source: "SEQUENCE", target: "START", label: "Sequence Completed", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e16", source: "KEY_VALUE", target: "START", label: "Key-Value Completed", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e17", source: "MULTILINE_START", target: "START", label: "Multiline Completed", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },


    { id: "e8", source: "KEY_VALUE", target: "INVALID", label: "Error in Key-Value", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e9", source: "KEY_VALUE", target: "SEQUENCE", label: "Start Sequence", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e10", source: "KEY_VALUE", target: "MULTILINE_START", label: "Multiline Value", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e11", source: "KEY_VALUE", target: "KEY_VALUE", label: "Continue Key-Value", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },


    { id: "e12", source: "MULTILINE_START", target: "INVALID", label: "Error in Multiline", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e13", source: "MULTILINE_START", target: "KEY_VALUE", label: "Complete Multiline", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' },
    { id: "e14", source: "MULTILINE_START", target: "SEQUENCE", label: "Multiline in Sequence", markerEnd: markedEnd, pathOptions: pathOptions, type: 'custom-edge' }
  ];

  const getEdgeForStep = (currentStep, previousStep) => {

    const previousState = previousStep ? previousStep.state : "START";

    const stateTransitions = {
      "START": {
        "SEQUENCE": "e1",
        "KEY_VALUE": "e2",
        "MULTILINE_START": "e3",
        "INVALID": "e4"
      },
      "SEQUENCE": {
        "INVALID": "e5",
        "KEY_VALUE": "e6",
        "SEQUENCE": "e7",
        "START": "e15"
      },
      "KEY_VALUE": {
        "INVALID": "e8",
        "SEQUENCE": "e9",
        "MULTILINE_START": "e10",
        "KEY_VALUE": "e11",
        "START": "e16"
      },
      "MULTILINE_START": {
        "INVALID": "e12",
        "KEY_VALUE": "e13",
        "SEQUENCE": "e14",
        "START": "e17"
      }
    };

    if (!previousStep) {
      return stateTransitions["START"][currentStep.state];
    }

    return stateTransitions[previousState]?.[currentStep.state] || null;
  };

  const [current, setCurrent] = useState({edge: ""});
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback(
      (params) => setEdges((eds) => addEdge(params, eds)),
      [],
  );

  useEffect(() => {
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        const previousStep = currentStep > 0 ? steps[currentStep - 1] : null;
        const edgeId = getEdgeForStep(steps[currentStep], previousStep);

        setCurrent({edge: edgeId, line: steps[currentStep].line, content: steps[currentStep].content, state: steps[currentStep].state, stack: steps[currentStep].stack});

        currentStep += 1;
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [steps]);

  return (
      <div style={{ height: "500px", border: "1px solid black", marginTop: "20px" }}>
        <ReactFlowProvider>
        <ReactFlow
            nodes={nodes}
            edges={edges.map((edge) => ({
              ...edge,
              style: edge.id === current.edge
                  ? { stroke: "green", strokeWidth: 3 }
                  : { stroke: "#ddd", strokeWidth: 1 },
              labelStyle: { fontSize: "12px", fill: "#555" },
              labelBgStyle: { fill: "white", fillOpacity: 0.8 },
              labelBgPadding: [8, 4],
              zIndex: edge.id === current.edge ? 2:1
            }))}
            fitView
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
        >
          <Background variant="dots" gap={12} size={1} />
          <MiniMap />
          <Controls />
        </ReactFlow>
        </ReactFlowProvider>
        {steps.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h4>Current State: {current.state}</h4>
              <p>Processing Line: {current.line}</p>
              <p>Current Edge: {edges.find((edge) => edge.id === current.edge)?.label}</p>
              <p>Current Content: {current.content}</p>
              <p>Stack: {JSON.stringify(current.stack)}</p>
            </div>
        )}
      </div>
  );
};

const YAMLValidatorApp = () => {
  const [yamlContent, setYAMLContent] = useState("");
  const [validationResult, setValidationResult] = useState({ isValid: null, errorMessage: "" });
  const [steps, setSteps] = useState([]);

  const handleValidate = () => {
    setSteps([]);
    const validator = new YAMLValidator((step) => setSteps((prev) => [...prev, step]));
    const result = validator.validateYAML(yamlContent);
    setValidationResult(result);
  };

  return (
      <div style={{ padding: "20px" }}>
        <h2>YAML Validator with Automaton Graph</h2>
        <textarea
            style={{ width: "100%", height: "200px", marginBottom: "10px" }}
            placeholder="Paste your YAML content here..."
            value={yamlContent}
            onChange={(e) => setYAMLContent(e.target.value)}
        />
        <button onClick={handleValidate}>Validate YAML</button>
        {validationResult.isValid !== null && (
            <div style={{ marginTop: "20px" }}>
              {validationResult.isValid ? (
                  <div style={{ color: "green" }}>Valid YAML format</div>
              ) : (
                  <div style={{ color: "red" }}>Invalid YAML format: {validationResult.errorMessage}</div>
              )}
            </div>
        )}
        <AutomatonGraph steps={steps} />
      </div>
  );
};

export default YAMLValidatorApp;
