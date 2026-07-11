# AI/ML Improvement Backlog - AgriNexus AI

This document logs the agronomy and machine learning enhancements earmarked for implementation directly following the core MVP feature sprint.

---

## 1. Disease Detection Accuracy & Model Optimization
Currently, the leaf analysis uses a basic CNN structure as a CPU scaffolding. To elevate accuracy for field deployment:
* **Transfer Learning:** Migrate the model to a pre-trained **ResNet-50** or **MobileNet-V3** (via `torchvision.models`).
* **Training Dataset:** Train the network on the open-source **PlantVillage** dataset, which consists of 54,303 healthy and diseased crop leaf images categorized into 38 distinct classes.
* **Quantization & Edge Inference:** Apply post-training quantization to reduce model size (~15MB instead of ~90MB) to facilitate fast mobile uploads or direct on-device CPU runtime.

---

## 2. Conversational Advisor Optimization (Hinglish & Local Dialect Support)
Local farmers frequently query the terminal using mixed language structures (e.g. *Hinglish* - Hindi written in Latin script with English keywords, like *"Tomato leaf pe brown spots hai, kya kare?"*). The current keyword engine is restricted.
* **LLM Temperature & System Prompts:** Instruct the Gemini model to respond in the matching colloquial dialect or code-mixed Hindi-English of the query.
* **Retrieval-Augmented Generation (RAG):**
  - Integrate a vector database (e.g. **ChromaDB** or **pgvector** inside our active PostgreSQL instance).
  - Parse local agricultural university guidelines and government scheme PDFs into semantic embeddings.
  - Intercept user queries, query the vector DB to retrieve localized agronomy solutions, and feed this matching context to the LLM.
