import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RowItemComponent } from './row-item.component';

describe('RowItemComponent', () => {
  let component: RowItemComponent;
  let fixture: ComponentFixture<RowItemComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RowItemComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RowItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
