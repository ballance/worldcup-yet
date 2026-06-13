output "function_name" {
  value = aws_lambda_function.poller.function_name
}

output "function_arn" {
  value = aws_lambda_function.poller.arn
}

output "schedule_rule_name" {
  value = aws_cloudwatch_event_rule.poll.name
}

output "ssm_parameter_name" {
  value = aws_ssm_parameter.api_key.name
}
