import { createResumeParserPipeline, parseResumeText } from "../../../../packages/ai/pipeline/resume-parser-pipeline.js";

export class AiResumeParserService {
  constructor({ pipeline = createResumeParserPipeline() } = {}) {
    this.pipeline = pipeline;
  }

  async parse({ extraction }) {
    return this.pipeline.run({ extraction });
  }
}

export { parseResumeText };
