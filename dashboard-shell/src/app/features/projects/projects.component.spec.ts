import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProjectsComponent } from './projects.component';
import { ProjectsService } from '../../shared/services/projects.service';

describe('ProjectsComponent', () => {
  let projectsServiceSpy: jasmine.SpyObj<ProjectsService>;

  beforeEach(async () => {
    projectsServiceSpy = jasmine.createSpyObj<ProjectsService>('ProjectsService', ['getProjects']);

    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [{ provide: ProjectsService, useValue: projectsServiceSpy }],
    }).compileComponents();
  });

  it('should render projects from live service data', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({
        projects: [
          {
            id: 'proj-001',
            name: 'Payments Gateway v3',
            description: 'Modernize payments gateway',
            status: 'active',
            team: 'platform',
            startDate: '2026-01-01',
            targetDate: '2026-06-30',
          },
        ],
        total: 1,
      })
    );

    const fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.projects.length).toBe(1);
    expect(compiled.textContent).toContain('Payments Gateway v3');
    expect(compiled.textContent).toContain('Showing 1 projects from live gateway data.');
  });

  it('should show retry state when live fetch fails', () => {
    projectsServiceSpy.getProjects.and.returnValue(throwError(() => new Error('gateway down')));

    const fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.errorMessage).toContain('Unable to load projects from gateway');
    expect(compiled.textContent).toContain('Try Again');
  });
});
