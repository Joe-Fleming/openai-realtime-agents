import React, { useState } from 'react';
import { Document } from 'langchain/document';

export default function RAGDemo() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Document[]>([]);
  const [chatHistory, setChatHistory] = useState<Array<{ question: string; answer: string; logs: Document[] }>>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/rag-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      setAnswer(data.answer);
      setLogs(data.retrievedDocuments);
      setChatHistory([...chatHistory, { question, answer: data.answer, logs: data.retrievedDocuments }]);
    } catch (error) {
      console.error('Error fetching RAG answer:', error);
      setAnswer('An error occurred while fetching the answer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', padding: '20px' }}>
      <div style={{ flex: 1 }}>
      <h1>RAG Demo</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question..."
          style={{ width: '300px', padding: '8px' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Submit'}
        </button>
      </form>
        <div style={{ marginTop: '20px' }}>
          {chatHistory.map((chat, index) => (
            <div key={index} style={{ marginBottom: '20px' }}>
              <h3>Question: {chat.question}</h3>
              <p>Answer: {chat.answer}</p>
              <h4>Logs:</h4>
              <ul>
                {chat.logs.map((log, logIndex) => (
                  <li key={logIndex}>
                    <strong>{log.metadata.question}</strong>: {log.pageContent}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: '300px', padding: '20px', borderLeft: '1px solid #ccc' }}>
        <h2>Logs</h2>
        <ul>
          {logs.map((log, index) => (
            <li key={index}>{log.pageContent}</li>
          ))}
        </ul>
      </div>
    </div>
  );
} 