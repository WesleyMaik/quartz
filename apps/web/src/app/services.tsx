import { FileRepository, ProjectRepository, QuartzDatabase } from "@qrtz/storage";
import { createContext, type ReactNode, useContext } from "react";
import { CompileService } from "../services/compile-service";
import { FileService } from "../services/file-service";
import { ProjectService } from "../services/project-service";

export interface Services {
  readonly db: QuartzDatabase;
  readonly projects: ProjectService;
  readonly files: FileService;
  readonly compiler: CompileService;
}

/** Composition root: the only place that wires storage, services and engines together. */
export function createServices(): Services {
  const db = new QuartzDatabase();
  const fileRepository = new FileRepository(db);
  return {
    db,
    projects: new ProjectService(new ProjectRepository(db)),
    files: new FileService(fileRepository, db),
    compiler: new CompileService((projectId) => fileRepository.snapshot(projectId)),
  };
}

const ServicesContext = createContext<Services | undefined>(undefined);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (services === undefined) throw new Error("useServices must be used inside ServicesProvider.");
  return services;
}
