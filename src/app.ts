import jobsService from "./services/jobs.service";

class ApplicationService {
  async start(): Promise<void> {
    await jobsService.start();
  }
}

export const applicationService = new ApplicationService();
