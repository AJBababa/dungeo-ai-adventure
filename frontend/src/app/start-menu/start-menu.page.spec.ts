import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StartMenuPage } from './start-menu.page';

describe('StartMenuPage', () => {
  let component: StartMenuPage;
  let fixture: ComponentFixture<StartMenuPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(StartMenuPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
