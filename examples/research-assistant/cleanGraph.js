// Simple script to clean the knowledge graph by removing invalid entries
const fs = require('fs');
const path = require('path');

const knowledgeGraphPath = path.join(__dirname, 'data/knowledge-graph.json');

/**
 * Check if a related paper entry is valid (not a placeholder)
 */
function isValidRelatedPaper(paper) {
  return (
    paper && 
    typeof paper === 'object' &&
    paper.title && 
    paper.title !== 'Unknown Title' &&
    paper.authors && 
    paper.authors !== 'Unknown Authors'
  );
}

/**
 * Clean the knowledge graph
 */
function cleanKnowledgeGraph() {
  try {
    // Read and parse the knowledge graph
    const knowledgeGraphData = fs.readFileSync(knowledgeGraphPath, 'utf-8');
    const knowledgeGraph = JSON.parse(knowledgeGraphData);

    console.log(`Initial state: ${Object.keys(knowledgeGraph.papers).length} papers, ${Object.keys(knowledgeGraph.concepts).length} concepts, ${knowledgeGraph.relationships.length} relationships`);
    
    // Clean papers with invalid related papers
    Object.keys(knowledgeGraph.papers).forEach(paperId => {
      const paper = knowledgeGraph.papers[paperId];
      
      // Clean related papers
      if (paper.internetRelatedPapers && Array.isArray(paper.internetRelatedPapers)) {
        // Filter out invalid related papers
        const originalCount = paper.internetRelatedPapers.length;
        paper.internetRelatedPapers = paper.internetRelatedPapers.filter(isValidRelatedPaper);
        if (originalCount !== paper.internetRelatedPapers.length) {
          console.log(`Cleaned paper ${paperId}: removed ${originalCount - paper.internetRelatedPapers.length} invalid related papers`);
        }
      }
    });

    // Remove papers with titles like "Mem0" that don't have valid related papers
    // (These are likely duplicate entries)
    const papersToRemove = [];
    Object.keys(knowledgeGraph.papers).forEach(paperId => {
      const paper = knowledgeGraph.papers[paperId];
      if (paper.title === "Mem0" && (!paper.internetRelatedPapers || paper.internetRelatedPapers.length === 0)) {
        papersToRemove.push(paperId);
      }
    });
    
    papersToRemove.forEach(paperId => {
      delete knowledgeGraph.papers[paperId];
      console.log(`Removed empty paper: ${paperId}`);
    });

    // Clean invalid concepts (those with "Unknown Title")
    const conceptsToRemove = [];
    Object.keys(knowledgeGraph.concepts).forEach(conceptName => {
      if (conceptName.includes('Unknown Title')) {
        conceptsToRemove.push(conceptName);
      }
    });
    
    // Remove invalid concepts
    conceptsToRemove.forEach(conceptName => {
      delete knowledgeGraph.concepts[conceptName];
      console.log(`Removed invalid concept: ${conceptName}`);
    });

    // Clean invalid relationships
    const originalRelCount = knowledgeGraph.relationships.length;
    knowledgeGraph.relationships = knowledgeGraph.relationships.filter(relationship => {
      // Keep relationships that don't include "Unknown Title"
      return !relationship.source.includes('Unknown Title') && 
             !relationship.target.includes('Unknown Title');
    });
    
    if (originalRelCount !== knowledgeGraph.relationships.length) {
      console.log(`Removed ${originalRelCount - knowledgeGraph.relationships.length} invalid relationships`);
    }

    // Write the cleaned knowledge graph back to the file
    fs.writeFileSync(knowledgeGraphPath, JSON.stringify(knowledgeGraph, null, 2));
    
    console.log(`Final state: ${Object.keys(knowledgeGraph.papers).length} papers, ${Object.keys(knowledgeGraph.concepts).length} concepts, ${knowledgeGraph.relationships.length} relationships`);
    console.log('Knowledge graph cleaned successfully!');
  } catch (error) {
    console.error('Error cleaning knowledge graph:', error);
  }
}

// Run the cleaning function
cleanKnowledgeGraph();
