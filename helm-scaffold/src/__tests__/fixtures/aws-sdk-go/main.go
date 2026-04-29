package main

import (
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

func main() {
	_ = s3.New(nil)
	_ = ssm.New(nil)
}
