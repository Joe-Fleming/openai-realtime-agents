import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { NextApiRequest, NextApiResponse } from 'next';
import sampleFAQ from '../../public/sample-faq.json';
import fs from 'fs';
import path from 'path';

// Load sample FAQ data
const documents: Document<Record<string, any>>[] = sampleFAQ.map((item: { question: string; answer: string }) => new Document({ pageContent: item.answer, metadata: { question: item.question } }));

// Load all .txt files from public directory
const publicDir = path.join(process.cwd(), 'public');
const txtFiles = fs.readdirSync(publicDir).filter(file => file.endsWith('.txt'));
txtFiles.forEach(file => {
  const content = fs.readFileSync(path.join(publicDir, file), 'utf-8');
  documents.push(new Document({ pageContent: content, metadata: { filename: file } }));
});

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings();

// Create an in-memory vector store and add documents
const vectorStore = new MemoryVectorStore(embeddings);
await vectorStore.addDocuments(documents);

// Define a prompt template for the RAG pipeline
const promptTemplate = ChatPromptTemplate.fromTemplate(
  'Answer the following question based on the provided context. Please provide a detailed and comprehensive response:\n\nContext: {context}\n\nQuestion: {question}\n\nAnswer:'
);

// Initialize OpenAI LLM
const llm = new ChatOpenAI();

// Create a chain that combines retrieval and generation
const chain = promptTemplate.pipe(llm);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // Retrieve relevant documents from the vector store
    const docs = await vectorStore.similaritySearch(question, 1);
    console.log('Retrieved Documents:', docs);
    const context = docs.map((doc) => doc.pageContent).join('\n');

    // Generate an answer using the chain
    const result = await chain.invoke({ context, question });
    console.log('Generated Response:', result.text);
    return res.status(200).json({ answer: result.text, retrievedDocuments: docs });
  } catch (error) {
    console.error('Error in RAG demo:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 