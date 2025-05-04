import * as core from '@actions/core'
import * as github from '@actions/github'
import { wait } from './wait.js'
import { readFileSync } from 'fs'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ms: string = core.getInput('milliseconds') || '100' // Default value if no input
    core.info(`Waiting for ${ms} milliseconds...`)
    core.debug(new Date().toTimeString())
    await wait(parseInt(ms, 10))
    core.debug(new Date().toTimeString())

    // Get PR number from context payload
    const prNumber: number | undefined =
      github.context.payload.pull_request?.number
    if (!prNumber) {
      core.warning('No PR number found. This action is meant to run on PRs.')
      return
    }

    // Read reviewer from REVIEWERS file
    let reviewer: string
    try {
      reviewer = readFileSync('REVIEWERS', 'utf8').trim()
    } catch {
      core.setFailed('REVIEWERS file not found or unreadable.')
      return
    }

    if (!reviewer) {
      core.setFailed('REVIEWERS file is empty.')
      return
    }

    const githubToken: string = core.getInput('github-token', {
      required: true
    })
    const octokit = github.getOctokit(githubToken)

    const reviews = await octokit.rest.pulls.listReviews({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber
    })

    // Track latest state per reviewer
    const latestReviewStates: Record<string, string> = {}
    for (const review of reviews.data) {
      const user = review.user?.login
      if (user) {
        latestReviewStates[user.toLowerCase()] = review.state
      }
    }

    const isApproved = latestReviewStates[reviewer.toLowerCase()] === 'APPROVED'

    if (!isApproved) {
      core.setFailed(`${reviewer} has not approved this PR.`)
      return
    }

    core.info(`✅ PR #${prNumber} has been approved by ${reviewer}.`)
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}
