package main
import (
	"fmt"
	"encoding/json"
	"net/http"
	"os"
	"io/ioutil"
	"regexp"
	"strconv"
	"crypto/tls"
	"log"
	"strings"
	"time"
)

//routine

type Result struct {
    url string
    source string
    status int
    message string
    body string
    contentType string
}

type Configuration struct {
    Url string
    Limit int
    DisplayProgress bool
    UrlsToIgnore []string
}

type DiscoveredUrl struct {
	url string
	source string
}

func checkUrl(url string, source string, resultChan chan Result) {
	go func() {
		tr := &http.Transport{ //we ignore ssl errors. This tool is for testing 404, not ssl.
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			IdleConnTimeout: 10 * time.Second,
		}
		client := &http.Client{Transport: tr}

		req, err := http.NewRequest("GET", url, nil)
		
		if err != nil {
            resultChan <- Result{url: url, source: source, status: -2, message: "Fatal error " + err.Error(), body: ""}
            return;
        }
        req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36")

        r, err := client.Do(req)

		if err != nil || r.StatusCode == 504 {
			//retrying in a simple way in case we had any network issues
			r, err = client.Do(req)
			if err != nil || r.StatusCode == 504 {
				//retry
				r, err = client.Do(req)
			}
		}


		if err != nil {
			resultChan <- Result{url: url, source: source, status: -1, message: "Fatal error " + err.Error(), body: ""}
		} else {
			contentType := r.Header["Content-Type"][0]
			result := Result{url: url, source: source, status: r.StatusCode, message: "", body: "", contentType: contentType}
			if isHtmlContentType(contentType) {
				defer r.Body.Close()
				body, err := ioutil.ReadAll(r.Body)
				if err != nil {
					result.status = -2
					result.message = "Fatal error " + err.Error()
				} else {
					result.body = fmt.Sprintf("%s", body)
	  			}				
			}

			resultChan <- result
		}
	}()
}

func findUrls(html string) []string {
	var urls = []string{}
	
	re := regexp.MustCompile("<a .*href=\"([^\"]*)")
	matches := re.FindAllStringSubmatch(html, -1)
	for _,match := range matches {
        urls = append(urls, match[1])
	}

	re = regexp.MustCompile("<img .*src=\"([^\"]*)")
	matches = re.FindAllStringSubmatch(html, -1)
	for _,match := range matches {
	    urls = append(urls, match[1])
	}

	re = regexp.MustCompile("<link .*href=\"([^\"]*)")
	matches = re.FindAllStringSubmatch(html, -1)
	for _,match := range matches {
  		urls = append(urls, match[1])
	}

	re = regexp.MustCompile("<script .*src=\"([^\"]*)")
	matches = re.FindAllStringSubmatch(html, -1)
	for _,match := range matches {
	    urls = append(urls, match[1])
	}

	return urls
}

func findRoot(url string) string {
	url = url + "/" //just in case url has no leading slash. More than one won't harm
	re := regexp.MustCompile("https?://([^/]*/)")
	root := re.FindString(url)
	return root
}

func checkWebsite(url string, limit int, urlsToIgnore []string, statsChan chan Result) bool {
	resultChan := make(chan Result)
	urlDiscoveryChan := make(chan DiscoveredUrl)
	pendingChecks := 1
	count := 0
	knownUrls := make(map[string]string)

	for _, knownUrl := range urlsToIgnore {
    	knownUrls[knownUrl] = knownUrl
	}

	finishOrLimitChan := make(chan bool)

	urlRoot := findRoot(url)

	go func(finishOrLimitChan chan bool, urlDiscoveryChan chan DiscoveredUrl) {
		for {

			if count >= limit {
				finishOrLimitChan <- true
				break
			}

			result := <- resultChan

			if strings.HasPrefix(result.url, urlRoot) && isHtmlContentType(result.contentType) {
				//parse page urls only if this page is on our domain
				newUrls := findUrls(result.body)
				for _,newUrl := range newUrls {
					if strings.HasPrefix(newUrl, "//") { //protocol relative url
						newUrl = urlRoot[0:strings.Index(urlRoot, ":") + 1] + newUrl
					}
					if string([]rune(newUrl)[0]) == "/" { //make sure we have an absolute URL
						newUrl = strings.Replace(newUrl, "/", urlRoot, 1)
					}
					if string([]rune(newUrl)[0]) == "#" { //skip if this is an internal link
						continue
					}
					if strings.HasPrefix(newUrl, "mailto:") { //skip data urls
						continue
					}
                    if strings.HasPrefix(newUrl, "data:") { //skip email urls
                        continue
                    }
					if _, ok := knownUrls[newUrl]; ok {
						continue
					}
					if !strings.HasPrefix(newUrl, urlRoot) {
						//fmt.Println(newUrl)
						//continue
					}
					knownUrls[newUrl] = result.url
					if pendingChecks > 5  {
						time.Sleep(5)
					}
					if pendingChecks > 10 {
						time.Sleep(20)
                    }
					if pendingChecks > 20 {
						time.Sleep(30)
                    }
					pendingChecks++
					go checkUrl(newUrl, result.url, resultChan)
				}
			} else {
				//fmt.Println(result.url)
			}
			statsChan <- result
            pendingChecks--
			count++

			if pendingChecks == 0 {
				finishOrLimitChan <- true
				break
			}
		}
	}(finishOrLimitChan, urlDiscoveryChan)

	//init the first check
	go checkUrl(url, "", resultChan)

	<-finishOrLimitChan
	return true
}

func isHtmlContentType(header string) bool {
	return strings.Contains(header, "text/html") 
}

func removeLineContent() {
	fmt.Print("\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b")
}

func parseConfigFile(filePath string) Configuration {
	file, _ := os.Open(filePath)
	decoder := json.NewDecoder(file)
	config := Configuration{}
	err := decoder.Decode(&config)
	if err != nil {
	  log.Fatal("error:", err)
	}
	return config
}

func parseArgs(args []string) Configuration {
	if len(args) != 3 && len(args) != 4 {
		log.Fatal("Invalid number of arguments.\nUsage example:\n\"go run link-checker.go http://example.com 100\"")
	}
	url := args[1]
 	limit, _ := strconv.Atoi(args[2])
 	displayProgress := true
 	if (len(args) > 3) {
 		displayProgress = args[3] == "1" || args[3] == "true"
 	}

 	config := Configuration {
 		Url: url,
 		Limit: limit,
 		DisplayProgress: displayProgress}
 		
 	return config
}


func main() {
	config := Configuration{}
	if len(os.Args) == 2 {
		config = parseConfigFile(os.Args[1])
	} else {
		config = parseArgs(os.Args)
	}

	 if config.Url[len(config.Url) - 1:] != "/" {
 		config.Url = config.Url + "/"
 	}

	statsChan := make(chan Result)
 	

	count := 0

	fmt.Println("Website to be checked " + config.Url + ".")
	fmt.Println("Max count of URLs to be checked " + strconv.Itoa(config.Limit))

	errorCount := 0

	go func(statsChan chan Result) {
		for {
			result := <- statsChan
			count++
			removeLineContent()
			if result.status != 200 {
				errorCount++
				fmt.Println("Error: HTTP status " + strconv.Itoa(result.status) + ", Url " + result.url + ", Source " + result.source + " " + result.message)	
			}
			if (config.DisplayProgress) {
				fmt.Print("URLs checked " + strconv.Itoa(count))
			}

		}
	}(statsChan)

	
	checkWebsite(config.Url, config.Limit, config.UrlsToIgnore, statsChan)
	removeLineContent()	
	fmt.Println()

	fmt.Println("Total URLs checked: " + strconv.Itoa(count))
	if errorCount == 0 {
		fmt.Println("No broken URLs")
	} else {
		fmt.Println("Broken URLs: " + strconv.Itoa(errorCount))
		os.Exit(1)
	}
}
