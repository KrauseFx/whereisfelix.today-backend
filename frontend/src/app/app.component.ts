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
  refresherInterval = null;

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.refreshData();

    // Poor person's reload for now, until we have proper
    // web streams and stuff
    let self = this;
    this.refresherInterval = setInterval(function() {
      self.refreshData();
    }, 3000);
  }

  data = <MyData> {
    loading: true
  };

  refreshData() {
    this.dataService.getData()
      .subscribe(data => {
        this.data = { ...data };
        console.log(this.data)

        if (this.data.loading != true) {
          // We got data, let's stop refreshing now
          clearInterval(this.refresherInterval);
        }
      },
      error => {
        console.log("Something went wrong...")
        console.log(error)
        this.data = <MyData> {
          loading: true
        }
      })
  }
}
