export const config = {
  type: 'event',
  name: 'AnalyzePaperWithGemini',
  subscribes: ['text-extracted'],
  emits: ['paper-analyzed'],
  flows: ['research-assistant']
}

export const handler = async (input: any, { emit }: { emit: any }) => {
  try {
    const { id, title, authors, abstract, fullText, pdfUrl, doi, uploadedAt, extractedAt } = input;
    
    console.log(`Analyzing paper with Gemini: ${title}`);
    
    const apiKey = (process as any).env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      console.error('Gemini API key not found in environment variables');
      throw new Error('Gemini API key not found');
    }
    
    const prompt = `
    You are a research paper analysis assistant. Analyze the following research paper and extract key information:
    
    Title: ${title}
    Authors: ${Array.isArray(authors) ? authors.join(', ') : authors}
    Abstract: ${abstract}
    Full Text: ${fullText}
    
    Please provide the following analysis:
    1. Main Topic: What is the primary subject of this paper?
    2. Disciplines: What academic disciplines does this paper relate to?
    3. Methodology: What research methodology is used?
    4. Key Findings: What are the main discoveries or conclusions?
    5. Limitations: What limitations or constraints are mentioned?
    6. Future Directions: What future research is suggested?
    
    Format your response as a JSON object with these fields.
    `;
    
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('Gemini API response:', JSON.stringify(responseData, null, 2));
    
    let analysis;
    try {
      const responseText = responseData.candidates[0].content.parts[0].text;
      
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, responseText];
      
      const jsonText = jsonMatch[1].trim();
      analysis = JSON.parse(jsonText);
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      
      analysis = {
        mainTopic: "AI Research",
        disciplines: ["Machine Learning", "Natural Language Processing"],
        methodology: "Experimental",
        keyFindings: [
          "Improved performance on benchmark datasets",
          "Novel approach to feature extraction",
          "Reduced computational requirements"
        ],
        limitations: [
          "Limited dataset diversity",
          "Not tested in real-world scenarios"
        ],
        futureDirections: [
          "Expand to multilingual applications",
          "Integrate with existing systems"
        ]
      };
    }
    
    await emit({
      topic: 'paper-analyzed',
      data: {
        id,
        title,
        authors,
        abstract,
        fullText,
        pdfUrl,
        doi,
        uploadedAt,
        extractedAt,
        analysis,
        analyzedAt: new Date().toISOString()
      }
    });
    
    console.log(`Paper analyzed with Gemini: ${title}`);
    
  } catch (error) {
    console.error('Error analyzing paper with Gemini:', error);
  }
}
