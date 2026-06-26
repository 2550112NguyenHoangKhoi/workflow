import React, { useState, useEffect } from 'react';
import { X, Network, Loader2 } from 'lucide-react';
import { ReactFlow, Controls, Background, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const ConceptMapModal = ({ isOpen, onClose }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetch('http://127.0.0.1:8000/api/documents')
        .then(res => res.json())
        .then(data => {
          if (data.documents && data.documents.length > 0) {
            const doc = data.documents[data.documents.length - 1];
            setActiveDoc(doc);
            generateMap(doc.content);
          } else {
            setError("Chưa có tài liệu. Vui lòng Upload tài liệu trước!");
          }
        })
        .catch(err => setError(err.message));
    } else {
      setNodes([]);
      setEdges([]);
      setError(null);
    }
  }, [isOpen]);

  const generateMap = async (textContent) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/generate_map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_or_text: textContent })
      });
      
      if (!response.ok) throw new Error('Failed to generate map');
      const data = await response.json();
      
      // The API returns { nodes: [{id, label}], edges: [{source, target, weight}] }
      // We need to format them for ReactFlow
      const flowNodes = data.nodes.map((n, i) => ({
        id: n.id,
        position: { x: Math.random() * 400, y: Math.random() * 300 }, // Simple random layout for now
        data: { label: n.label },
        style: { 
          backgroundColor: '#F8EFEA', 
          border: '2px solid #8A334B', 
          borderRadius: '8px',
          padding: '10px',
          fontWeight: 600,
          color: '#1B2A4E',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }
      }));

      const flowEdges = data.edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: '#3B6B59', strokeWidth: 2 }
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes) => setEdges((eds) => applyEdgeChanges(changes, eds));

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(27, 42, 78, 0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '24px', width: '90%', maxWidth: '1000px', height: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px', borderBottom: '1px solid var(--border-light)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#F8EFEA'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#8A334B', padding: '10px', borderRadius: '12px' }}>
              <Network color="white" size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1B2A4E', fontWeight: 800 }}>Semantic Concept Map</h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Generated locally via TF-IDF clustering</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--text-secondary)'
          }}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, position: 'relative', backgroundColor: '#FAFAFA' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--brand-primary)' }}>
              <Loader2 size={48} className="animate-spin" style={{ marginBottom: '16px' }} />
              <div style={{ fontWeight: 600 }}>Analyzing semantic relationships...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '24px', color: 'red' }}>Error: {error}</div>
          ) : (
            <ReactFlow 
              nodes={nodes} 
              edges={edges} 
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
            >
              <Background color="#ccc" gap={16} />
              <Controls />
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConceptMapModal;
