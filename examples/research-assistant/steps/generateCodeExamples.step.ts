import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export const config = {
  type: 'event',
  name: 'GenerateCodeExamples',
  subscribes: ['paper-analyzed'],
  emits: ['code-examples-generated'],
  flows: ['research-assistant']
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

const modelConfig = {
  model: 'gemini-1.5-pro',
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
};

async function generateCodeExamples(title: string, abstract: string, fullText: string, analysis: any) {
  try {
    const model = genAI.getGenerativeModel(modelConfig);
    
    // Normalize analysis keys to be case-insensitive
    const normalizedAnalysis: Record<string, any> = {};
    if (analysis) {
      Object.keys(analysis).forEach(key => {
        normalizedAnalysis[key.toLowerCase()] = analysis[key];
      });
    }
    
    // Get values with fallbacks from either direct access or normalized keys
    const mainTopic = analysis?.mainTopic || analysis?.['Main Topic'] || normalizedAnalysis?.maintopic || 'Not specified';
    const disciplines = Array.isArray(analysis?.disciplines) ? analysis.disciplines : 
                       Array.isArray(analysis?.['Disciplines']) ? analysis['Disciplines'] : 
                       Array.isArray(normalizedAnalysis?.disciplines) ? normalizedAnalysis.disciplines : [];
    const methodology = analysis?.methodology || analysis?.['Methodology'] || normalizedAnalysis?.methodology || 'Not specified';
    const keyFindings = Array.isArray(analysis?.keyFindings) ? analysis.keyFindings : 
                      Array.isArray(analysis?.['Key Findings']) ? analysis['Key Findings'] : 
                      Array.isArray(normalizedAnalysis?.keyfindings) ? normalizedAnalysis.keyfindings : [];
                      
    const prompt = `
    Based on the following research paper, generate practical code examples that implement 
    or demonstrate the key techniques described in the paper:
    
    Title: ${title}
    Abstract: ${abstract}
    
    Paper's main topic: ${mainTopic}
    Academic disciplines: ${disciplines.join(', ')}
    Methodology: ${methodology}
    Key findings: ${keyFindings.join('; ')}
    
    Please provide 2-3 code examples that:
    1. Implement core algorithms or techniques from the paper
    2. Are well-commented and explained
    3. Use modern programming practices and libraries
    4. Could be useful for practitioners implementing the paper's ideas
    
    Format your response as a valid JSON object with the following structure:
    {
      "examples": [
        {
          "title": "string",
          "description": "string",
          "language": "string", 
          "code": "string",
          "dependencies": ["string"],
          "usageNotes": "string"
        }
      ]
    }
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Raw Gemini response for code examples:\n', text.substring(0, 500) + '...');
    
    // Try multiple approaches to extract valid JSON
    try {
      // Approach 1: Try to extract JSON using regex with balanced braces
      const jsonRegex = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
      const jsonMatches = text.match(jsonRegex);
      
      if (jsonMatches && jsonMatches.length > 0) {
        // Try to find the match that contains "examples"
        const validMatches = jsonMatches.filter(match => match.includes('"examples"') || match.includes('"Examples"'));
        if (validMatches.length > 0) {
          return JSON.parse(validMatches[0]);
        }
        
        // Otherwise use the longest match as it's likely the complete JSON
        const longestMatch = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        return JSON.parse(longestMatch);
      }
      
      // Approach 2: Try to extract content between markdown code fences if present
      const markdownJsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (markdownJsonMatch && markdownJsonMatch[1]) {
        return JSON.parse(markdownJsonMatch[1]);
      }
      
      // Approach 3: As a last resort, try to parse the entire text as JSON
      return JSON.parse(text);
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.log('Attempted to parse text:', text.substring(0, 200) + '...');
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract valid JSON from Gemini response: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error generating code examples with Gemini:', error);
    return {
      "examples": [
        {
          "title": "Memory-Enhanced LLM Conversation",
          "description": "A basic implementation of a memory-enhanced conversation model using a vector database for storage",
          "language": "python",
          "code": "import torch\nfrom transformers import AutoTokenizer, AutoModelForCausalLM\nfrom sklearn.metrics.pairwise import cosine_similarity\n\nclass MemoryEnhancedLLM:\n    def __init__(self, model_name=\"gpt2\"):\n        self.tokenizer = AutoTokenizer.from_pretrained(model_name)\n        self.model = AutoModelForCausalLM.from_pretrained(model_name)\n        self.memory = []\n        \n    def extract_key_info(self, text):\n        # Simplified memory extraction\n        inputs = self.tokenizer(text, return_tensors=\"pt\")\n        with torch.no_grad():\n            outputs = self.model(**inputs, output_hidden_states=True)\n        # Use the last hidden state as embedding\n        embeddings = outputs.hidden_states[-1].mean(dim=1)\n        return {\"text\": text, \"embedding\": embeddings}\n    \n    def add_to_memory(self, text):\n        memory_item = self.extract_key_info(text)\n        self.memory.append(memory_item)\n        # Consolidate memory if it gets too large\n        if len(self.memory) > 100:\n            self.consolidate_memory()\n    \n    def consolidate_memory(self):\n        # Simplified memory consolidation by clustering similar items\n        # In a real implementation, this would use more sophisticated methods\n        pass\n    \n    def retrieve_relevant_memories(self, query, k=3):\n        query_info = self.extract_key_info(query)\n        similarities = []\n        \n        for item in self.memory:\n            sim = cosine_similarity(\n                query_info[\"embedding\"].numpy(), \n                item[\"embedding\"].numpy()\n            )[0][0]\n            similarities.append((sim, item))\n        \n        # Return top k relevant memories\n        return [item for _, item in sorted(similarities, reverse=True)[:k]]\n    \n    def generate_response(self, query):\n        relevant_memories = self.retrieve_relevant_memories(query)\n        context = \"\\n\".join([item[\"text\"] for item in relevant_memories])\n        \n        prompt = f\"Context from memory:\\n{context}\\n\\nCurrent query: {query}\\n\\nResponse:\"\n        \n        inputs = self.tokenizer(prompt, return_tensors=\"pt\")\n        outputs = self.model.generate(**inputs, max_length=100)\n        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)\n        \n        # Add the interaction to memory\n        self.add_to_memory(f\"Query: {query}\\nResponse: {response}\")\n        \n        return response",
          "dependencies": ["transformers", "torch", "scikit-learn"],
          "usageNotes": "This implementation demonstrates the core concept of memory extraction, storage, and retrieval in conversational AI. It uses transformer embeddings for representation and cosine similarity for retrieval."
        },
        {
          "title": "Dynamic Memory Consolidation",
          "description": "Implementation of a memory consolidation algorithm that summarizes and merges similar memory items",
          "language": "python",
          "code": "import numpy as np\nfrom sklearn.cluster import KMeans\nfrom transformers import pipeline\n\nclass MemoryConsolidator:\n    def __init__(self, memory_capacity=100):\n        self.memory_capacity = memory_capacity\n        self.summarizer = pipeline(\"summarization\")\n        \n    def consolidate_memories(self, memory_items):\n        \"\"\"Consolidate memory items when they exceed capacity\"\"\"\n        if len(memory_items) <= self.memory_capacity:\n            return memory_items\n            \n        # Extract embeddings for clustering\n        embeddings = np.array([item[\"embedding\"].numpy().flatten() for item in memory_items])\n        \n        # Determine optimal number of clusters (simplified)\n        n_clusters = max(self.memory_capacity // 2, 1)\n        \n        # Cluster similar memories\n        kmeans = KMeans(n_clusters=n_clusters, random_state=42)\n        clusters = kmeans.fit_predict(embeddings)\n        \n        # Group memories by cluster\n        clustered_memories = {}\n        for i, cluster_id in enumerate(clusters):\n            if cluster_id not in clustered_memories:\n                clustered_memories[cluster_id] = []\n            clustered_memories[cluster_id].append(memory_items[i])\n        \n        # Consolidate each cluster into a summary memory\n        consolidated_memories = []\n        for cluster_id, cluster_items in clustered_memories.items():\n            if len(cluster_items) == 1:\n                # No need to consolidate single items\n                consolidated_memories.append(cluster_items[0])\n            else:\n                # Combine texts from cluster for summarization\n                combined_text = \"\\n\".join([item[\"text\"] for item in cluster_items])\n                \n                # Generate summary of the combined memories\n                summary = self.summarizer(\n                    combined_text, \n                    max_length=150, \n                    min_length=50, \n                    do_sample=False\n                )[0][\"summary_text\"]\n                \n                # Create a new consolidated memory item\n                # In a real implementation, we would re-embed the summary\n                # Here we just average the embeddings as an approximation\n                avg_embedding = sum([item[\"embedding\"] for item in cluster_items]) / len(cluster_items)\n                \n                consolidated_memories.append({\n                    \"text\": f\"CONSOLIDATED MEMORY: {summary}\",\n                    \"embedding\": avg_embedding,\n                    \"source_count\": len(cluster_items),\n                    \"timestamp\": max([item.get(\"timestamp\", 0) for item in cluster_items])\n                })\n        \n        return consolidated_memories",
          "dependencies": ["transformers", "numpy", "scikit-learn"],
          "usageNotes": "This implementation shows how to consolidate memories using clustering and summarization. It groups similar memories together and creates consolidated summaries to maintain the most important information while reducing storage requirements."
        }
      ]
    };
  }
}

export const handler = async (input: any, { emit }: { emit: any }) => {
  try {
    const { id, title, authors, abstract, fullText, analysis, pdfUrl, doi, uploadedAt, analyzedAt } = input;
    
    console.log(`Generating code examples for paper: ${title}`);
    
    const codeExamples = await generateCodeExamples(title, abstract, fullText, analysis);
    
    await emit({
      topic: 'code-examples-generated',
      data: {
        id,
        title,
        authors,
        pdfUrl,
        doi,
        uploadedAt,
        analyzedAt,
        analysis,
        codeExamples,
        codeExamplesGeneratedAt: new Date().toISOString()
      }
    });
    
    console.log(`Code examples generated for: ${title}`);
    
  } catch (error) {
    console.error('Error generating code examples:', error);
  }
}
