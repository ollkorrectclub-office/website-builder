import { DeterministicDeployAdapter } from "@/lib/deploy/deterministic-deployer";
import type { DeployInput, DeployService } from "@/lib/deploy/types";

class AdapterDeployService implements DeployService {
  private readonly adapter = new DeterministicDeployAdapter();

  async createDeploySnapshot(input: DeployInput) {
    return this.adapter.deploy(input, "publish_requested");
  }
}

export function getDeployService(): DeployService {
  return new AdapterDeployService();
}
