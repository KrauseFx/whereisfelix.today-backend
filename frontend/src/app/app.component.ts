import { Component } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { HttpEvent, HttpHandler, HttpInterceptor } from '@angular/common/http';
import { MyData, DataService } from './data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent {
  title = 'app';

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.refreshData();

    // Poor person's reload for now, until we have proper
    // web streams and stuff
    let self = this;

    // We always want to refresh
    // as some stuff takes longer to load sometimes
    // e.g. the mood, so we just wait
    setInterval(function() {
      self.refreshData();
    }, 15000);
  }

  data = <MyData> {
    loading: true
  };
  showAllFood = false

  refreshData() {
    this.dataService.getData()
      .subscribe(data => {
        this.data = { ...data };
      },
      error => {
        console.log("Something went wrong...")
        console.log(error)
        this.data = <MyData> {
          loading: true
        }
      })
  }

  toggleFood() {
    this.showAllFood = !this.showAllFood;
  }
}
