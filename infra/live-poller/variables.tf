variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "live-poller"
}

variable "s3_bucket" {
  description = "S3 bucket the Lambda writes live.json to"
  type        = string
}

variable "ssm_parameter_name" {
  description = "SSM SecureString holding the upstream API key"
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge schedule expression. Note: aws_cloudwatch_event_rule requires minimum rate(1 minute); for sub-minute cadence switch to aws_scheduler_schedule."
  type        = string
  default     = "rate(1 minute)"
}

variable "lambda_bundle_path" {
  description = "Path to the bundle.zip produced by build.sh"
  type        = string
  default     = "../../lambda/wcy-live-poller/bundle.zip"
}

variable "tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default     = {}
}
