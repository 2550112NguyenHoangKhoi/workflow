import React, { useState, useEffect, useRef } from 'react';
import { X, Network, Loader2, Download } from 'lucide-react';
import { ReactFlow, Controls, Background, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { toPng } from 'html-to-image';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 80;

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
    return newNode;
  });

  return { nodes: newNodes, edges };
};

const ConceptMapModal = ({ isOpen, onClose }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [projId, setProjId] = useState(null);
  const [docId, setDocId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const matchDoc = window.location.hash.match(/#\/document\/([^/]+)/);
      const matchProj = window.location.hash.match(/#\/project\/([^/]+)/);
      const parsedDocId = matchDoc ? parseInt(matchDoc[1], 10) : null;
      const parsedProjId = matchProj ? parseInt(matchProj[1], 10) : null;

      setProjId(parsedProjId);
      setDocId(parsedDocId);

      let url = 'http://127.0.0.1:8000/api/documents';
      if (parsedProjId) {
        url += `?project_id=${parsedProjId}`;
      }

      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.documents && data.documents.length > 0) {
            let doc = data.documents[data.documents.length - 1];
            if (parsedDocId) {
              const found = data.documents.find(d => d.id === parsedDocId);
              if (found) doc = found;
            } else {
              const storedId = sessionStorage.getItem('active_document_id');
              if (storedId) {
                const found = data.documents.find(d => String(d.id) === String(storedId));
                if (found) doc = found;
              }
            }
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
      setProjId(null);
      setDocId(null);
    }
  }, [isOpen]);

  const generateMap = async (textContent) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/generate_map', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          topic_or_text: textContent,
          api_key: localStorage.getItem('workflow_api_key') || '',
          project_id: projId,
          document_id: docId
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate map');
      const data = await response.json();
      
      // The API returns { nodes: [{id, label}], edges: [{source, target, weight}] }
      // We need to format them for ReactFlow
      const flowNodes = data.nodes.map((n, i) => ({
        id: n.id,
        position: { x: 0, y: 0 },
        data: { label: n.label, definition: n.definition, formula: n.formula },
        style: { 
          backgroundColor: '#F8EFEA', 
          border: '2px solid #8A334B', 
          borderRadius: '8px',
          padding: '10px',
          fontWeight: 600,
          color: 'var(--text-navy)',
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

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const reactFlowWrapper = useRef(null);

  const exportToPNG = () => {
    if (reactFlowWrapper.current === null) return;

    toPng(reactFlowWrapper.current, { backgroundColor: '#FAFAFA' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `ConceptMap_${activeDoc?.filename || 'Export'}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Failed to export map as PNG', err);
      });
  };

  const onNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes) => setEdges((eds) => applyEdgeChanges(changes, eds));
  const onNodeClick = (_, node) => setSelectedNode(node);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(27, 42, 78, 0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-tertiary)', borderRadius: '24px', width: '90%', maxWidth: '1000px', height: '80vh',
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
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-navy)', fontWeight: 800 }}>Semantic Concept Map</h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Generated locally via TF-IDF clustering</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {nodes.length > 0 && (
              <button onClick={exportToPNG} title="Export to PNG" style={{ background: '#E8F5E9', border: 'none', cursor: 'pointer', color: '#065F46', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.875rem' }}>
                <Download size={16} /> Export Map
              </button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--text-secondary)'
            }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative', backgroundColor: '#FAFAFA' }}>
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
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedNode(null)}
              fitView
            >
              <Background color="#ccc" gap={16} />
              <Controls />
            </ReactFlow>
          )}

          {/* Node Details Panel */}
          {selectedNode && (
            <div className="animate-fade-in" style={{
              position: 'absolute', bottom: '24px', left: '24px', right: '24px',
              backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', padding: '20px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
              border: '1px solid var(--border-medium)', zIndex: 10,
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-navy)' }}>
                  {selectedNode.data.label}
                </h3>
                <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {selectedNode.data.definition || 'Không có định nghĩa chi tiết.'}
              </div>
              {selectedNode.data.formula && (
                <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', color: '#166534', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 600, overflowX: 'auto' }}>
                  {selectedNode.data.formula}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConceptMapModal;
