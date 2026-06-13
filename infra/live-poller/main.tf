data "aws_caller_identity" "current" {}

resource "aws_ssm_parameter" "api_key" {
  name        = var.ssm_parameter_name
  description = "Upstream API key for live scores (set value manually after apply)"
  type        = "SecureString"
  value       = "REPLACE_AFTER_APPLY"
  tags        = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name_prefix        = "${var.name_prefix}-"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "inline" {
  statement {
    sid     = "ReadSSMParam"
    actions = ["ssm:GetParameter"]
    resources = [
      "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_parameter_name}"
    ]
  }

  statement {
    sid     = "WriteLiveJson"
    actions = ["s3:PutObject", "s3:GetObject"]
    resources = ["arn:aws:s3:::${var.s3_bucket}/live.json"]
  }
}

resource "aws_iam_role_policy" "inline" {
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.inline.json
}

resource "aws_lambda_function" "poller" {
  function_name    = var.name_prefix
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  memory_size      = 128
  timeout          = 10
  filename         = var.lambda_bundle_path
  source_code_hash = filebase64sha256(var.lambda_bundle_path)

  environment {
    variables = {
      BUCKET  = var.s3_bucket
      SSM_KEY = var.ssm_parameter_name
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_event_rule" "poll" {
  name_prefix         = "${var.name_prefix}-"
  schedule_expression = var.schedule_expression
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "poll" {
  rule = aws_cloudwatch_event_rule.poll.name
  arn  = aws_lambda_function.poller.arn
}

resource "aws_lambda_permission" "allow_events" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.poller.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.poll.arn
}
